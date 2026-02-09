import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import '../styles/CreateGroupChatPopup.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function CreateGroupChatPopup() {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [chatRoomName, setChatRoomName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const usersList = response.data.users || response.data;
        const myUuid = jwtDecode(token).sub;
        setUsers(usersList.filter(u => u.uuid !== myUuid));
      } catch (error) {
        console.error('사용자 목록 불러오기 실패:', error);
      }
    };

    fetchUsers();
  }, []);

  const toggleSelect = (uuid) => {
    setSelectedUsers(prev =>
      prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
    );
  };

  const createGroupChat = async () => {
    if (selectedUsers.length < 2) {
      alert('2명 이상 선택해야 그룹 채팅이 생성됩니다.');
      return;
    }

    const token = localStorage.getItem('token');
    const myUuid = jwtDecode(token).sub;

    try {
      const response = await axios.post(`${API_BASE}/api/create-chat-room`, {
        members: [...selectedUsers, myUuid]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const roomUuid = response.data.room_uuid;
      window.location.href = `/message?room=${roomUuid}`;
    } catch (error) {
      console.error('그룹 채팅방 생성 실패:', error);
      alert('그룹 채팅방 생성에 실패했습니다.');
    }
  };

  return (
    <div className="create-group-container">
      <h2 className="create-group-header">그룹 채팅방 생성</h2>
      
      <input
        type="text"
        placeholder="채팅방 이름 (선택사항)"
        value={chatRoomName}
        onChange={(e) => setChatRoomName(e.target.value)}
        className="group-name-input"
      />
      
      {selectedUsers.length > 0 && (
        <div className="selected-count">
          선택된 사용자: {selectedUsers.length}명
        </div>
      )}
      
      <div className="users-list-container">
        {users.map(u => (
          <div key={u.uuid} className="user-item" onClick={() => toggleSelect(u.uuid)}>
            <input
              type="checkbox"
              checked={selectedUsers.includes(u.uuid)}
              onChange={() => toggleSelect(u.uuid)}
            />
            <div className="user-label">
              <span className="user-name">{u.name}</span>
              <span className="user-department">({u.department})</span>
            </div>
          </div>
        ))}
      </div>
      
      <button 
        onClick={createGroupChat} 
        className="create-button"
        disabled={selectedUsers.length < 2}
      >
        📨 채팅 시작 ({selectedUsers.length + 1}명)
      </button>
    </div>
  );
}

export default CreateGroupChatPopup;