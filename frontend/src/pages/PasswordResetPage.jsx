import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/PasswordResetPage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function PasswordResetPage() {
  const [formData, setFormData] = useState({
    username: '',
    employee_id: '',
    department: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetRequest, setResetRequest] = useState(null);
  const [showStatus, setShowStatus] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!formData.username.trim() || !formData.employee_id.trim() || !formData.department.trim()) {
      setErrorMessage('모든 필드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post(`${API_BASE}/api/password-reset/request`, formData);
      
      setSuccessMessage(response.data.message);
      setResetRequest({ ...response.data, status: 'pending' });
      
    } catch (error) {
      console.error('❌ 비밀번호 재설정 요청 실패:', error);
      
      if (error.response) {
        setErrorMessage(error.response.data?.error || '요청 처리 중 오류가 발생했습니다.');
      } else if (error.request) {
        setErrorMessage('네트워크 연결을 확인해주세요.');
      } else {
        setErrorMessage('요청 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!formData.username.trim() || !formData.employee_id.trim() || !formData.department.trim()) {
      setErrorMessage('사용자 정보를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post(`${API_BASE}/api/password-reset/status`, formData);
      
      setResetRequest(response.data.request);
      setSuccessMessage(`${response.data.user_name}님의 요청 현황을 불러왔습니다.`);
      setShowStatus(true);
      
    } catch (error) {
      console.error('❌ 상태 확인 실패:', error);
      
      if (error.response) {
        if (error.response.status === 404) {
          setErrorMessage(error.response.data?.message || '해당 정보로 요청 내역을 찾을 수 없습니다.');
        } else {
          setErrorMessage(error.response.data?.error || '상태 확인 중 오류가 발생했습니다.');
        }
      } else {
        setErrorMessage('네트워크 연결을 확인해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusMessage = (status) => {
    switch (status) {
      case 'pending':
        return { message: '관리자 승인 대기 중입니다.', color: '#f39c12', icon: '⏳' };
      case 'approved':
        return { message: '비밀번호 변경이 승인되었습니다!', color: '#27ae60', icon: '✅' };
      case 'rejected':
        return { message: '요청이 거부되었습니다.', color: '#e74c3c', icon: '❌' };
      case 'completed':
        return { message: '비밀번호 변경이 완료되었습니다.', color: '#95a5a6', icon: '✔️' };
      default:
        return { message: '알 수 없는 상태입니다.', color: '#95a5a6', icon: '❓' };
    }
  };

  const goToPasswordReset = () => {
    navigate('/password-change', { 
      state: { 
        username: formData.username,
        employee_id: formData.employee_id,
        department: formData.department
      } 
    });
  };

  return (
    <div className="password-reset-container">
      <h2>비밀번호 찾기</h2>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="아이디"
          value={formData.username}
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
          type="text"
          name="department"
          placeholder="부서"
          value={formData.department}
          onChange={handleChange}
          disabled={isLoading}
        />
        
        {errorMessage && (
          <div className="message error">
            {errorMessage}
          </div>
        )}
        
        {successMessage && (
          <div className="message success">
            {successMessage}
          </div>
        )}
        
        <div className="button-group">
          <button type="submit" disabled={isLoading}>
            {isLoading ? '처리 중...' : '비밀번호 재설정 요청'}
          </button>
          <button type="button" onClick={checkStatus} disabled={isLoading}>
            {isLoading ? '확인 중...' : '신청 현황 확인'}
          </button>
        </div>
      </form>

      {resetRequest && (
        <div className="status-card">
          <h3>📋 신청 현황</h3>
          <div className="status-info">
            {(() => {
              const statusInfo = getStatusMessage(resetRequest.status);
              return (
                <div className="status-message" style={{ color: statusInfo.color }}>
                  <span className="status-icon">{statusInfo.icon}</span>
                  {statusInfo.message}
                </div>
              );
            })()}
            
            <div className="request-details">
              <p><strong>요청 일시:</strong> {new Date(resetRequest.requested_at).toLocaleString()}</p>
              {resetRequest.processed_at && (
                <p><strong>처리 일시:</strong> {new Date(resetRequest.processed_at).toLocaleString()}</p>
              )}
            </div>
            
            {resetRequest.status === 'approved' && (
              <div className="approved-actions">
                <p className="change-notice">
                  🔒 비밀번호를 변경하실 수 있습니다.
                </p>
                <button 
                  className="change-password-btn"
                  onClick={goToPasswordReset}
                >
                  비밀번호 변경하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="links">
        <div className="link-item">
          <a href="/">로그인으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}

export default PasswordResetPage;