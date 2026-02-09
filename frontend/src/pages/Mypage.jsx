import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Mypage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function Mypage() {
  const [userInfo, setUserInfo] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/');
      return;
    }

    const fetchUserInfo = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserInfo(response.data);
      } catch (error) {
        console.error('사용자 정보 불러오기 실패:', error);
        alert('사용자 정보를 불러올 수 없습니다.');
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  const handleChangePassword = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await axios.put(`${API_BASE}/api/users/me/password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data.message || '비밀번호 변경 성공');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      const msg = err.response?.data?.error || '비밀번호 변경 실패';
      alert(msg);
    }
  };

  const goToMain = () => {
    navigate('/main');
  };

  if (!userInfo) return <div>로딩 중...</div>;

  return (
    <div className="mypage-container">
      <h2>👤 마이페이지</h2>

      <div className="info-section">
        <p><strong>이름:</strong> {userInfo.name}</p>
        <p><strong>사번:</strong> {userInfo.employee_id}</p>
        <p><strong>부서:</strong> {userInfo.department}</p>
        <p><strong>직책:</strong> {userInfo.position}</p>
        <p><strong>직급:</strong> {userInfo.grade}</p>
        <p><strong>이메일:</strong> {userInfo.email}</p>
        <p><strong>아이디:</strong> {userInfo.username}</p>
        <p><strong>관리자 여부:</strong> {userInfo.is_admin ? '✅ 예' : '❌ 아니오'}</p>
      </div>

      <div className="password-section">
        <h3>🔐 비밀번호 변경</h3>
        <input
          type="password"
          placeholder="현재 비밀번호"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="새 비밀번호"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <button onClick={handleChangePassword}>비밀번호 변경</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button onClick={goToMain}>🏠 메인으로</button>
      </div>
    </div>
  );
}

export default Mypage;