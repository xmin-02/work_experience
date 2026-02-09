import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/PasswordChangePage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function PasswordChangePage() {
  const [formData, setFormData] = useState({
    username: '',
    employee_id: '',
    department: '',
    new_password: '',
    confirm_password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 이전 페이지에서 전달받은 사용자 정보 설정
    if (location.state) {
      setFormData(prev => ({
        ...prev,
        username: location.state.username || '',
        employee_id: location.state.employee_id || '',
        department: location.state.department || ''
      }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!formData.username.trim() || !formData.employee_id.trim() || !formData.department.trim()) {
      setErrorMessage('사용자 정보를 모두 입력해주세요.');
      return;
    }

    if (!formData.new_password.trim()) {
      setErrorMessage('새 비밀번호를 입력해주세요.');
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.new_password.length < 4) {
      setErrorMessage('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post(`${API_BASE}/api/password-reset/reset`, {
        username: formData.username,
        employee_id: formData.employee_id,
        department: formData.department,
        new_password: formData.new_password
      });
      
      setSuccessMessage(response.data.message);
      
      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate('/');
      }, 3000);
      
    } catch (error) {
      console.error('❌ 비밀번호 변경 실패:', error);
      
      if (error.response) {
        setErrorMessage(error.response.data?.error || '비밀번호 변경 중 오류가 발생했습니다.');
      } else if (error.request) {
        setErrorMessage('네트워크 연결을 확인해주세요.');
      } else {
        setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="password-change-container">
      <h2>🔒 비밀번호 변경</h2>
      <p className="info-text">승인된 요청에 대해 새로운 비밀번호를 설정하세요.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="user-info-section">
          <h3>사용자 정보 확인</h3>
          <input
            type="text"
            name="username"
            placeholder="아이디"
            value={formData.username}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          <input
            type="text"
            name="employee_id"
            placeholder="사번"
            value={formData.employee_id}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          <input
            type="text"
            name="department"
            placeholder="부서"
            value={formData.department}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>

        <div className="password-section">
          <h3>새 비밀번호 설정</h3>
          <input
            type="password"
            name="new_password"
            placeholder="새 비밀번호 (최소 4자)"
            value={formData.new_password}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          <input
            type="password"
            name="confirm_password"
            placeholder="새 비밀번호 확인"
            value={formData.confirm_password}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>
        
        {errorMessage && (
          <div className="message error">
            ❌ {errorMessage}
          </div>
        )}
        
        {successMessage && (
          <div className="message success">
            ✅ {successMessage}
            <p className="redirect-notice">3초 후 로그인 페이지로 이동합니다...</p>
          </div>
        )}
        
        <button type="submit" disabled={isLoading || successMessage}>
          {isLoading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
      
      <div className="links">
        <div className="link-item">
          <a href="/password-reset">비밀번호 찾기로 돌아가기</a>
        </div>
        <div className="link-separator">•</div>
        <div className="link-item">
          <a href="/">로그인 페이지로</a>
        </div>
      </div>
    </div>
  );
}

export default PasswordChangePage;