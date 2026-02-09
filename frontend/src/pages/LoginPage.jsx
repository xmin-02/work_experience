import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/LoginPage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!username.trim() || !password.trim()) {
      setErrorMessage('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await axios.post(`${API_BASE}/api/login`, {
        username,
        password,
      });

      // 로그인 성공
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('is_admin', response.data.is_admin);
      console.log('✅ 로그인 성공');
      navigate('/main');
      
    } catch (error) {
      console.error('❌ 로그인 실패:', error);
      
      if (error.response) {
        const serverError = error.response.data?.error || error.response.data?.message || '로그인에 실패했습니다.';
        setErrorMessage(serverError);
      } else if (error.request) {
        setErrorMessage('네트워크 연결을 확인해주세요.');
      } else {
        setErrorMessage('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    // 입력 시 에러 메시지 초기화
    if (errorMessage) setErrorMessage('');
  };

  const handlePasswordReset = () => {
    navigate('/password-reset');
  };

  return (
    <div className="login-container">
      <h2>하이쎄미코 사내 메신저</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={handleInputChange(setUsername)}
          disabled={isLoading}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={handleInputChange(setPassword)}
          disabled={isLoading}
        />
        
        {errorMessage && (
          <div style={{ color: '#e74c3c', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>
      <div className="links">
        <div className="link-item">
          <a href="/register">회원가입</a>
        </div>
        <div className="link-separator">•</div>
        <div className="link-item">
          <button type="button" className="link-button" onClick={handlePasswordReset}>비밀번호 찾기</button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;