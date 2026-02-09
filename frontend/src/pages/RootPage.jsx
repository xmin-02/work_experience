import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/RootPage.css'; // ✅ 스타일 분리

const API_BASE = process.env.REACT_APP_API_BASE;

function RootPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showLoginBox, setShowLoginBox] = useState(false); // 로그인 박스 표시 상태

  const handleIconClick = () => {
    setShowLogin(true);
    // 로고 이동 애니메이션 완료 후 로그인 박스 표시
    setTimeout(() => {
      setShowLoginBox(true);
    }, 500); // CSS transition 시간과 맞춤
  };

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/login`, { username, password });
      alert(res.data.message);
      localStorage.setItem('token', res.data.token);
      navigate('/main');
      
    } catch (err) {
        console.log('❌ 로그인 오류:', err.response);
        const raw = err.response?.data;
        const message = raw?.error || raw?.message || '서버 응답 없음';
        alert(`로그인 실패: ${message}`);
    }
  };

  const handlePasswordReset = () => {
    navigate('/password-reset');
  };

  const handleRegister = () => {
    navigate('/register');
  };

  return (
    <div className="root-page">
      <div className={`icon ${showLogin ? 'move-up' : ''}`} onClick={handleIconClick}>
        <img src="/hisemico.png" alt="icon" />
      </div>

      {showLoginBox && (
        <div className="login-box">
          <input
            type="text"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();  // ✅ 엔터 키로 로그인
            }}
          />
          <button type="submit" onClick={handleLogin}>로그인</button>
          <div className="links">
            <button type="button" className="link-button" onClick={handleRegister}>회원가입</button>
            <span className="link-separator">|</span>
            <button type="button" className="link-button" onClick={handlePasswordReset}>비밀번호 찾기</button>
          </div>
        </div>
        
      )}
    </div>
  );
}

export default RootPage;