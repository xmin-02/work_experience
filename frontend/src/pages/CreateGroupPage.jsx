import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import '../styles/CreateGroupPage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function CreateGroupPage() {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [me, setMe] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      alert('로그인이 필요합니다.');
      window.close();
      return;
    }

    // 현재 사용자 정보 가져오기
    const myUuid = jwtDecode(token).sub;
    
    // 사용자 목록 가져오기
    axios.get(`${API_BASE}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      let userList = [];
      if (Array.isArray(res.data)) {
        userList = res.data;
      } else if (res.data && Array.isArray(res.data.users)) {
        userList = res.data.users;
      }
      
      // 본인 제외
      const filteredUsers = userList.filter(user => user.uuid !== myUuid);
      setUsers(filteredUsers);
      
      // 현재 사용자 설정
      const currentUser = userList.find(u => u.uuid === myUuid);
      if (currentUser) setMe(currentUser);
    }).catch(err => {
      console.error('사용자 목록 불러오기 실패:', err);
      alert('사용자 목록을 불러올 수 없습니다.');
    });
  }, [token]);

  const toggleUserSelection = (userUuid) => {
    setSelectedUsers(prev => 
      prev.includes(userUuid) 
        ? prev.filter(uuid => uuid !== userUuid)
        : [...prev, userUuid]
    );
  };

  const createGroupChat = async () => {
    if (selectedUsers.length < 1) {
      alert('최소 1명 이상 선택해야 합니다.');
      return;
    }

    if (!groupName.trim()) {
      alert('그룹 채팅방 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    
    try {
      const res = await axios.post(`${API_BASE}/api/create-chat-room`, {
        members: [...selectedUsers, me?.uuid],
        name: groupName.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const roomUuid = res.data.room_uuid;
      
      // 새 채팅방을 같은 창에서 열기
      window.location.href = `/message?room=${roomUuid}`;
      
    } catch (err) {
      console.error('그룹 채팅방 생성 실패:', err);
      alert('그룹 채팅방 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="create-group-container">
      <div className="create-group-header">
        <button 
          className="back-to-main-btn" 
          onClick={() => window.location.href = '/main'}
          title="메인 화면으로 돌아가기"
        >
          ← 메인
        </button>
        <h2>🎉 새 채팅 시작하기</h2>
        <button className="close-btn" onClick={() => window.close()}>×</button>
      </div>

      <div className="group-name-section">
        <label htmlFor="groupName">채팅방 이름</label>
        <input
          id="groupName"
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="채팅방 이름을 입력하세요"
          className="group-name-input"
        />
      </div>

      <div className="user-search-section">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 이름, 부서, 직책으로 검색"
          className="user-search-input"
        />
      </div>

      <div className="selected-users-section">
        <h3>선택된 사용자 ({selectedUsers.length}명)</h3>
        {selectedUsers.length > 0 && (
          <div className="selected-users-list">
            {selectedUsers.map(userUuid => {
              const user = users.find(u => u.uuid === userUuid);
              return user ? (
                <span key={userUuid} className="selected-user-tag">
                  {user.name}
                  <button onClick={() => toggleUserSelection(userUuid)}>×</button>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      <div className="users-list-section">
        <h3>사용자 목록</h3>
        <div className="users-list">
          {filteredUsers.map(user => (
            <div 
              key={user.uuid} 
              className={`user-item ${selectedUsers.includes(user.uuid) ? 'selected' : ''}`}
              onClick={() => toggleUserSelection(user.uuid)}
            >
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-detail">{user.department} | {user.position}</div>
              </div>
              <div className="user-checkbox">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.uuid)}
                  readOnly
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="create-group-footer">
        <button 
          className="create-btn"
          onClick={createGroupChat}
          disabled={loading || selectedUsers.length === 0 || !groupName.trim()}
        >
          {loading ? '생성 중...' : `채팅방 만들기 (${selectedUsers.length + 1}명)`}
        </button>
      </div>
    </div>
  );
}

export default CreateGroupPage;