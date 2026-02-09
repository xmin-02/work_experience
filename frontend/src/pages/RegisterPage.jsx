import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/RegisterPage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    birth_date: '',
    position: '',
    grade: '',
    department: '',
    email: '',
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const requiredFields = ['name', 'employee_id', 'birth_date', 'position', 'grade', 'department', 'email', 'username', 'password'];
    const emptyFields = requiredFields.filter(field => !formData[field].trim());

    if (emptyFields.length > 0) {
      setErrorMessage('모든 필드를 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorMessage('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await axios.post(`${API_BASE}/api/register`, formData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      alert(response.data.message || '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.');
      navigate('/');
    } catch (error) {
      console.error('❌ 회원가입 오류:', error.response || error);

      if (error.response) {
        const serverError = error.response.data?.error || error.response.data?.message || '서버 오류가 발생했습니다.';
        setErrorMessage(serverError);
      } else if (error.request) {
        setErrorMessage('네트워크 연결을 확인해주세요.');
      } else {
        setErrorMessage('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2>하이쎄미코 회원가입</h2>
      <form onSubmit={handleRegister}>
        <input 
          type="text" 
          name="name" 
          placeholder="이름" 
          value={formData.name} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="text" 
          name="employee_id" 
          placeholder="사번" 
          value={formData.employee_id} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="date" 
          name="birth_date" 
          placeholder="생년월일" 
          value={formData.birth_date} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="text" 
          name="position" 
          placeholder="직책" 
          value={formData.position} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="text" 
          name="grade" 
          placeholder="직급" 
          value={formData.grade} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="text" 
          name="department" 
          placeholder="부서" 
          value={formData.department} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="email" 
          name="email" 
          placeholder="이메일" 
          value={formData.email} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="text" 
          name="username" 
          placeholder="아이디" 
          value={formData.username} 
          onChange={handleChange}
          disabled={isLoading}
        />
        <input 
          type="password" 
          name="password" 
          placeholder="비밀번호" 
          value={formData.password} 
          onChange={handleChange}
          disabled={isLoading}
        />
        
        {errorMessage && (
          <div style={{ color: '#e74c3c', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? '가입 중...' : '회원가입'}
        </button>
      </form>
      <div className="links">
        <div className="link-item">
          <a href="/">이미 계정이 있으신가요?</a>
        </div>
        <div className="link-separator">•</div>
        <div className="link-item">
          <a href="/">로그인하기</a>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;