// ✅ MainPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import socket from '../socket';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import '../styles/MainPage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function MainPage() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [groupedByPosition, setGroupedByPosition] = useState({});
  const [groupedByDepartment, setGroupedByDepartment] = useState({});
  const [openGroups, setOpenGroups] = useState({
    all: false,
    position: false,
    department: false,
    positionSub: {},
    departmentSub: {}
  });
  const [unreadMap, setUnreadMap] = useState({});
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectingGroup, setSelectingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('unreadMap');
    if (stored) {
      try {
        setUnreadMap(JSON.parse(stored));
      } catch {
        setUnreadMap({});
      }
    }
  }, []);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/chat-rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 안전하게 배열 데이터 설정
      if (Array.isArray(res.data)) {
        setChatRooms(res.data);
      } else if (res.data && Array.isArray(res.data.chatRooms)) {
        setChatRooms(res.data.chatRooms);
      } else {
        console.error('예상하지 못한 채팅방 API 응답 형식:', res.data);
        setChatRooms([]);
      }
    } catch (err) {
      console.error('❌ 채팅방 목록 불러오기 실패', err);
      setChatRooms([]); // 에러 시 빈 배열로 설정
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    axios.get(`${API_BASE}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      console.log('API 응답 데이터:', res.data); // 디버깅용 로그
      
      // 안전하게 배열 데이터 추출
      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && Array.isArray(res.data.users)) {
        list = res.data.users;
      } else {
        console.error('예상하지 못한 API 응답 형식:', res.data);
        list = [];
      }
      
      setUsers(list);
      
      // 현재 사용자 찾기 (배열이 있을 때만)
      if (list.length > 0) {
        const myUuid = jwtDecode(token).sub;
        const currentUser = list.find(u => u.uuid === myUuid);
        if (currentUser) setMe(currentUser);
      }
    }).catch(err => {
      console.error('사용자 목록 불러오기 실패:', err);
      setUsers([]); // 에러 시 빈 배열로 설정
    });

    fetchChatRooms();
  }, [token, fetchChatRooms]);

  useEffect(() => {
    const byPosition = {};
    const byDepartment = {};

    // users가 배열인지 확인한 후 처리
    if (Array.isArray(users) && users.length > 0) {
      users.forEach(user => {
        // user 객체와 필요한 속성들이 있는지 확인
        if (user && user.position && user.department) {
          if (!byPosition[user.position]) byPosition[user.position] = [];
          byPosition[user.position].push(user);

          if (!byDepartment[user.department]) byDepartment[user.department] = [];
          byDepartment[user.department].push(user);
        }
      });
    }

    setGroupedByPosition(byPosition);
    setGroupedByDepartment(byDepartment);
  }, [users]);

  const toggleGroup = (type) => {
    setOpenGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleSubGroup = (type, key) => {
    setOpenGroups(prev => ({
      ...prev,
      [`${type}Sub`]: {
        ...prev[`${type}Sub`],
        [key]: !prev[`${type}Sub`]?.[key]
      }
    }));
  };

  useEffect(() => {
    if (!token) return;

    socket.connect();
    socket.emit('authenticate', { token });

    socket.on('user_list', (data) => {
      setOnlineUsers(data.map(u => u.uuid));
    });

    socket.on('new_message', ({ sender_uuid, room_uuid }) => {
      console.log('새 메시지 수신:', { sender_uuid, room_uuid });
      
      if (room_uuid) {
        // 그룹 채팅 메시지인 경우 - 백엔드에서 실제 안 읽음 수를 계산하므로 fetchChatRooms만 호출
        console.log('그룹 채팅 메시지 수신 - 채팅방 목록 갱신');
        fetchChatRooms(); // 채팅방 목록 즉시 갱신 (백엔드에서 실제 안 읽음 수 계산)
      } else {
        // 1:1 채팅 메시지인 경우 - 기존 로직 유지
        setUnreadMap(prev => {
          const updated = { ...prev, [sender_uuid]: (prev[sender_uuid] || 0) + 1 };
          localStorage.setItem('unreadMap', JSON.stringify(updated));
          return updated;
        });
        fetchChatRooms(); // 채팅방 목록 갱신
      }
    });

    // 그룹 메시지 이벤트 - 백엔드에서 실제 안 읽음 수를 계산하므로 fetchChatRooms만 호출
    socket.on('group_message', ({ room_uuid, sender_uuid }) => {
      console.log('그룹 메시지 이벤트 수신:', { room_uuid, sender_uuid });
      fetchChatRooms(); // 채팅방 목록 즉시 갱신 (백엔드에서 실제 안 읽음 수 계산)
    });

    return () => {
      socket.disconnect();
      socket.off('user_list');
      socket.off('new_message');
      socket.off('group_message');
    };
  }, [token, fetchChatRooms]);

  const isOnline = (uuid) => onlineUsers.includes(uuid);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleAdminPage = () => navigate('/admin');
  const handleMypage = () => navigate('/mypage');

  const openChatPopup = (target) => {
    const width = 480;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    
    // 그룹 채팅방의 경우 target.uuid를 room 파라미터로 사용
    const url = target.is_group
      ? `/message?room=${target.uuid}`
      : `/message?target=${target.uuid}`;

    setUnreadMap(prev => {
      const updated = { ...prev, [target.uuid]: 0 };
      localStorage.setItem('unreadMap', JSON.stringify(updated));
      return updated;
    });

    window.open(
      url,
      `${target.name}와의 채팅`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  const openGroupChatPopup = () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
  
    window.open(
      '/create-group',
      '그룹 채팅 만들기',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  const handleDeleteChatRoom = async (room) => {
    const uuid = room.is_group ? room.uuid || room.room_uuid : room.uuid;
  
    if (!uuid) {
      console.error('❌ 삭제할 room UUID가 없습니다:', room);
      alert('삭제할 채팅방 정보를 찾을 수 없습니다.');
      return;
    }
  
    if (!window.confirm('정말 이 채팅방을 삭제하시겠습니까?')) return;
  
    try {
      await axios.delete(`${API_BASE}/api/delete-chat-room/${uuid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ 채팅방이 삭제되었습니다.');
      fetchChatRooms(); // 목록 갱신
    } catch (err) {
      console.error('❌ 채팅방 삭제 실패', err);
      alert('채팅방 삭제에 실패했습니다.');
    }
  };

  const toggleUserSelection = (uuid) => {
    setSelectedUsers(prev =>
      prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
    );
  };

  const createGroupChat = async () => {
    if (selectedUsers.length < 2) {
      alert('2명 이상 선택해야 그룹 채팅이 생성됩니다.');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/create-chat-room`, {
        members: [...selectedUsers, me.uuid]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const room_uuid = res.data.room_uuid;
      window.open(`/message?room=${room_uuid}`, '_blank', 'width=480,height=600');
      setSelectingGroup(false);
      setSelectedUsers([]);
      fetchChatRooms();
    } catch (err) {
      console.error('❌ 그룹 채팅방 생성 실패', err);
    }
  };
  
  // 검색 기능 추가
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers([]);
    } else {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.position.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredUsers([]);
  };

  const handleChatClick = (chat) => {
    console.log('채팅 클릭:', chat);
    if (chat.is_group) {
      navigate(`/message/group/${chat.uuid}`);
    } else {
      navigate(`/message/${chat.uuid}`);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    // 같은 날짜인지 확인
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit'
      });
    }
  };

  const renderUserItem = (u) => (
    <li key={u.uuid} className={`user-item ${isOnline(u.uuid) ? 'online' : 'offline'}`}>
      <div className="user-info">
        <div className="user-status">
          <span className={`status-indicator ${isOnline(u.uuid) ? 'online' : 'offline'}`}>
            {isOnline(u.uuid) ? '🟢' : '⚪'}
          </span>
          <span className="user-text">{u.name} | {u.department}</span>
        </div>
      </div>
      {u.uuid !== me?.uuid && (
        selectingGroup ? (
          <input
            type="checkbox"
            checked={selectedUsers.includes(u.uuid)}
            onChange={() => toggleUserSelection(u.uuid)}
          />
        ) : (
          <button className="chat-btn" onClick={() => openChatPopup(u)}>채팅</button>
        )
      )}
    </li>
  );

  return (
    <div className="main-container">
      <header className="main-header">
        {me ? (
          <div className="user-menu">
            <button className="menu-toggle-btn" onClick={() => setIsMenuOpen(prev => !prev)}>
              <strong>{me.name}</strong> | {me.department}
              <span className={`arrow-icon menu ${isMenuOpen ? 'open' : ''}`}>◀</span>
            </button>
            {isMenuOpen && (
              <div className="dropdown-menu">
                <div onClick={handleMypage}>마이페이지</div>
                {me.is_admin && <div onClick={handleAdminPage}>관리자 페이지</div>}
                <div onClick={handleLogout}>로그아웃</div>
              </div>
            )}
          </div>
        ) : (
          <div className="current-user">로딩 중...</div>
        )}
      </header>

      <aside className="user-list-panel">
        <h2>사용자 목록</h2>
        
        <div className="user-search-container">
          <input
            type="text"
            className="user-search-input"
            placeholder="🔍 이름, 부서, 직책으로 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={clearSearch}>
              ✕ 초기화
            </button>
          )}
        </div>

        {filteredUsers.length > 0 && (
          <div className="search-results-info">
            검색 결과: {filteredUsers.length}명 찾음
          </div>
        )}

        <div className="group-toggle" onClick={() => toggleGroup('all')}>
          <span className={`arrow-icon list ${openGroups.all ? 'open' : ''}`}>▶</span>
          전체 사용자 {searchQuery && `(${filteredUsers.length > 0 ? filteredUsers.length : 0})`}
        </div>
        {openGroups.all && <ul>{(filteredUsers.length > 0 ? filteredUsers : users).map(renderUserItem)}</ul>}

        <div>
          <div className="group-toggle" onClick={() => toggleGroup('position')}>
            <span className={`arrow-icon list ${openGroups.position ? 'open' : ''}`}>▶</span>
            직책별
          </div>
          {openGroups.position &&
            Object.entries(groupedByPosition).map(([pos, list]) => (
              <div key={pos}>
                <div className="sub-toggle" onClick={() => toggleSubGroup('position', pos)}>
                  <span className={`arrow-icon list ${openGroups.positionSub[pos] ? 'open' : ''}`}>▶</span>
                  {pos}
                </div>
                {openGroups.positionSub[pos] && <ul>{list.map(renderUserItem)}</ul>}
              </div>
            ))}
        </div>

        <div>
          <div className="group-toggle" onClick={() => toggleGroup('department')}>
            <span className={`arrow-icon list ${openGroups.department ? 'open' : ''}`}>▶</span>
            부서별
          </div>
          {openGroups.department &&
            Object.entries(groupedByDepartment).map(([dept, list]) => (
              <div key={dept}>
                <div className="sub-toggle" onClick={() => toggleSubGroup('department', dept)}>
                  <span className={`arrow-icon list ${openGroups.departmentSub[dept] ? 'open' : ''}`}>▶</span>
                  {dept}
                </div>
                {openGroups.departmentSub[dept] && <ul>{list.map(renderUserItem)}</ul>}
              </div>
            ))}
        </div>
      </aside>

      <main className="main-content">
        <div className="chat-header">
          <h2>💬 채팅방 목록</h2>
          <button className="create-group-btn" onClick={openGroupChatPopup}>
            ➕ 채팅 시작하기
          </button>
        </div>

        {selectingGroup && selectedUsers.length >= 2 && (
          <button className="confirm-group-btn" onClick={createGroupChat}>
            📨 그룹 채팅방 생성
          </button>
        )}

        <div className="chat-room-list">
          {Array.isArray(chatRooms) && chatRooms.length > 0 ? (
            chatRooms
              .filter(room => room.last_message && room.last_message.trim() !== "") // 빈 메시지 필터링 개선
              .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)) // 최신순 정렬
              .map(room => (
                <div 
                  key={room.uuid} 
                  className={`chat-room-item ${unreadMap[room.uuid] > 0 ? 'has-unread' : ''}`}
                  onClick={() => openChatPopup(room)}
                >
                  <div className="chat-avatar">
                    {room.is_group ? (
                      <div className="group-avatar">👥</div>
                    ) : (
                      <div className="personal-avatar">
                        <span className="avatar-icon">👤</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="chat-content">
                    <div className="chat-header-info">
                      <div className="chat-name">
                        {room.is_group ? room.name : `${room.name}`}
                      </div>
                      <div className="chat-timestamp">
                        {room.timestamp && formatTime(room.timestamp)}
                      </div>
                    </div>
                    
                    <div className="chat-preview">
                      <div className="last-message">
                        {(() => {
                          if (!room.last_message || !room.last_message.trim()) {
                            return '메시지가 없습니다.';
                          }
                          
                          const message = room.last_message.trim();
                          // 안전한 문자열 자르기 - 한글 문자 고려
                          if (message.length > 10) {
                            return `${message.substring(0, 10)}...`;
                          }
                          return message;
                        })()}
                      </div>
                      
                      <div className="chat-badges">
                        {/* 그룹 채팅방은 백엔드에서 제공하는 unread_count 사용, 1:1 채팅은 unreadMap 사용 */}
                        {((room.is_group && room.unread_count > 0) || (!room.is_group && unreadMap[room.uuid] > 0)) && (
                          <span className="unread-count">
                            {room.is_group ? room.unread_count : unreadMap[room.uuid]}
                          </span>
                        )}
                        <button 
                          className="delete-btn" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDeleteChatRoom(room); 
                          }}
                          title="채팅방 삭제"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="empty-chat-state">
              <div className="empty-icon">💬</div>
              <h3>참여 중인 채팅방이 없습니다</h3>
              <p>새로운 채팅을 시작해보세요!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MainPage;