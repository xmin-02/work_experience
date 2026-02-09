import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; // 사용되지만, 실제 코드에서의 활용 확인 후 제거할 수 있음
import '../styles/AdminPage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false); // 더보기 상태

  const navigate = useNavigate();

  const initialize = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/');
      return;
    }

    try {
      console.log('🔍 JWT 토큰:', token);
      const decoded = jwtDecode(token);
      console.log('🔍 JWT 디코드 결과:', decoded);
      const myUuid = decoded.sub;
      console.log('🔍 내 UUID:', myUuid);

      const res = await axios.get(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('🔍 API 응답:', res.data);
      
      // API 응답이 배열인지 확인하고 안전하게 처리
      const usersList = Array.isArray(res.data) ? res.data : [];
      const me = usersList.find(u => u.uuid === myUuid);
      console.log('🔍 찾은 내 정보:', me);

      if (!me) {
        console.error('❌ 내 정보를 찾을 수 없습니다. UUID 일치하지 않음');
        alert('사용자 정보를 찾을 수 없습니다.');
        navigate('/');
        return;
      }

      if (!me.is_admin) {
        console.error('❌ 관리자가 아닙니다. is_admin:', me.is_admin);
        alert('관리자만 접근 가능합니다.');
        navigate('/main');
        return;
      }

      console.log('✅ 관리자 권한 확인됨');

      await Promise.all([loadPendingUsers(), loadApprovedUsers(), loadPasswordResetRequests()]);

    } catch (err) {
      console.error('❌ 관리자 확인 또는 유저 불러오기 실패:', err.response || err.message);
      alert('접근 권한이 없습니다.');
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    initialize();
  }, [initialize]); // initialize를 의존성 배열에 추가하여 경고를 해결

  const loadPendingUsers = async () => {
    const token = localStorage.getItem('token');
    const pending = await axios.get(`${API_BASE}/api/pending-users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPendingUsers(pending.data);
  };

  const loadApprovedUsers = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${API_BASE}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const decoded = jwtDecode(token);
    const myUuid = decoded.sub;
    
    // API 응답이 배열인지 확인하고 안전하게 처리
    const usersList = Array.isArray(res.data) ? res.data : [];
    setApprovedUsers(usersList.filter(u => u.uuid !== myUuid)); // 자기 자신 제외
  };

  const loadPasswordResetRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/admin/password-reset-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPasswordResetRequests(response.data);
    } catch (error) {
      console.error('❌ 비밀번호 재설정 요청 목록 로딩 실패:', error);
    }
  };

  const handleApprove = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API_BASE}/api/approve-user/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ 승인 완료');
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      initialize(); // 승인되었으니 목록 다시 로딩
    } catch (err) {
      console.error('❌ 승인 실패:', err.response || err.message);
      alert('❌ 승인 실패');
    }
  };

  const handleReject = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API_BASE}/api/reject-user/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('🚫 반려 완료');
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('❌ 반려 실패:', err.response || err.message);
      alert('❌ 반려 실패');
    }
  };

  const handleDelete = async (userId) => {
    const token = localStorage.getItem('token');
    const confirmed = window.confirm('정말 이 사용자를 탈퇴시키겠습니까?');
    if (!confirmed || !token) return;

    try {
      await axios.delete(`${API_BASE}/api/delete-user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('🗑️ 사용자 계정 삭제 완료');
      setApprovedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('❌ 사용자 삭제 실패:', err.response || err.message);
      alert('❌ 사용자 삭제 실패');
    }
  };

  const handleApprovePasswordReset = async (requestId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API_BASE}/api/password-reset/approve/${requestId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('비밀번호 재설정 요청이 승인되었습니다.');
      await loadPasswordResetRequests(); // 목록 새로고침
    } catch (error) {
      console.error('❌ 비밀번호 재설정 승인 실패:', error);
      alert(error.response?.data?.error || '승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleRejectPasswordReset = async (requestId) => {
    const token = localStorage.getItem('token');
    if (!window.confirm('이 비밀번호 재설정 요청을 거부하시겠습니까?')) return;
    
    try {
      await axios.put(`${API_BASE}/api/password-reset/reject/${requestId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('비밀번호 재설정 요청이 거부되었습니다.');
      await loadPasswordResetRequests(); // 목록 새로고침
    } catch (error) {
      console.error('❌ 비밀번호 재설정 거부 실패:', error);
      alert(error.response?.data?.error || '거부 처리 중 오류가 발생했습니다.');
    }
  };

  const goToMain = () => navigate('/main');

  // 표시할 사용자 목록 (5명 제한 또는 전체)
  const displayedUsers = showAllUsers ? approvedUsers : approvedUsers.slice(0, 5);
  const hasMoreUsers = approvedUsers.length > 5;

  return (
    <div className="admin-container">
      <h2>👥 관리자 페이지</h2>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={goToMain} style={{ marginRight: '10px' }}>🏠 메인 페이지로 이동</button>
      </div>

      {/* 1. 승인 대기 사용자 */}
      <section className="pending-section">
        <h3>🕓 승인 대기 사용자</h3>
        {pendingUsers.length === 0 ? (
          <p>대기 중인 사용자가 없습니다.</p>
        ) : (
          <ul>
            {pendingUsers.map(user => (
              <li key={user.id}>
                <strong>{user.name}</strong> ({user.username}) | {user.email}
                <div className="button-group">
                  <button onClick={() => handleApprove(user.id)}>✅ 승인</button>
                  <button onClick={() => handleReject(user.id)}>❌ 거절</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. 비밀번호 재설정 요청 */}
      <section className="password-reset-section">
        <h3>🔒 비밀번호 재설정 요청</h3>
        {passwordResetRequests.length === 0 ? (
          <p>비밀번호 재설정 요청이 없습니다.</p>
        ) : (
          <ul>
            {passwordResetRequests.map(request => (
              <li key={request.id}>
                <strong>{request.username}</strong> | {request.email}
                <span className="request-info">
                  사번: {request.employee_id} | 부서: {request.department}
                </span>
                <span className="request-date">
                  요청일: {new Date(request.created_at).toLocaleDateString('ko-KR')}
                </span>
                <div className="button-group">
                  <button onClick={() => handleApprovePasswordReset(request.id)}>✅ 승인</button>
                  <button onClick={() => handleRejectPasswordReset(request.id)}>❌ 거부</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. 전체 사용자 목록 (5명 제한 + 더보기) */}
      <section className="approved-section">
        <h3>✅ 전체 사용자 목록 
          <span className="user-count">
            ({showAllUsers ? approvedUsers.length : Math.min(5, approvedUsers.length)} / {approvedUsers.length}명)
          </span>
        </h3>
        {approvedUsers.length === 0 ? (
          <p>가입된 사용자가 없습니다.</p>
        ) : (
          <>
            <ul>
              {displayedUsers.map(user => (
                <li key={user.uuid}>
                  <strong>{user.name}</strong> ({user.username}) | {user.department}
                  <button onClick={() => handleDelete(user.id)}>🗑️ 탈퇴</button>
                </li>
              ))}
            </ul>
            
            {hasMoreUsers && (
              <div className="more-users-section">
                {!showAllUsers ? (
                  <button 
                    className="show-more-btn" 
                    onClick={() => setShowAllUsers(true)}
                  >
                    더보기 ({approvedUsers.length - 5}명 더)
                  </button>
                ) : (
                  <button 
                    className="show-less-btn" 
                    onClick={() => setShowAllUsers(false)}
                  >
                    접기 (처음 5명만 보기)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default AdminPage;