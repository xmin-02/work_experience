import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import socket from '../socket';
import { jwtDecode } from 'jwt-decode';
import { useLocation, useSearchParams } from 'react-router-dom';
import '../styles/MessagePage.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function MessagePage() {
  const [users, setUsers] = useState([]);
  const [myName, setMyName] = useState('');
  const [myUuid, setMyUuid] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(null); // 삭제 메뉴 표시 상태
  const [deleteLoading, setDeleteLoading] = useState(false); // 삭제 로딩 상태
  const chatLogRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null); // 롱 프레스 타이머
  const token = localStorage.getItem('token');
  const [searchParams] = useSearchParams();

  const targetUuid = searchParams.get('target');
  const roomUuid = searchParams.get('room');

  useEffect(() => {
    if (!token) return;

    const uuid = jwtDecode(token).sub;
    setMyUuid(uuid);

    const fetchAll = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        console.log('API 응답 데이터:', res.data); // 디버깅용
        
        // API 응답이 배열인지 확인하고 안전하게 처리
        const usersList = Array.isArray(res.data) ? res.data : 
                         (res.data.users && Array.isArray(res.data.users)) ? res.data.users : [];
        
        console.log('처리된 사용자 목록:', usersList); // 디버깅용
        setUsers(usersList);

        const me = usersList.find(u => u.uuid === uuid);
        if (me) setMyName(me.name);

        if (targetUuid) {
          const targetUser = usersList.find(u => u.uuid === targetUuid);
          if (targetUser) {
            setSelectedUser(targetUser);
            const msgRes = await axios.get(`${API_BASE}/api/messages/${targetUser.uuid}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            // 메시지 응답도 안전하게 처리
            const messagesList = Array.isArray(msgRes.data) ? msgRes.data : 
                               (msgRes.data.messages && Array.isArray(msgRes.data.messages)) ? msgRes.data.messages : [];
            
            setMessages(messagesList);
            scrollToBottom();
          }
        } else if (roomUuid) {
          const roomRes = await axios.get(`${API_BASE}/api/chat-rooms/${roomUuid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const { members = [], messages: msgs = [] } = roomRes.data || {};
          setSelectedUser({
            uuid: null, // 그룹 채팅에서는 uuid를 사용하지 않음
            name: members.map(m => m.name).join(', ') + ' 그룹채팅',
            isGroup: true
          });
          
          // 메시지 배열 안전 처리
          const messagesList = Array.isArray(msgs) ? msgs : [];
          setMessages(messagesList);
          scrollToBottom();
        }
      } catch (err) {
        console.error('사용자/채팅방 정보 로딩 실패', err);
      }
    };

    fetchAll();
  }, [token, targetUuid, roomUuid]);

  useEffect(() => {
    if (!token) return;

    socket.connect();
    socket.emit('authenticate', { token });

    const handleIncomingMessage = (msg) => {
      if (
        (roomUuid && msg.room_uuid === roomUuid) ||
        (!roomUuid && (
          (msg.sender_uuid === selectedUser?.uuid && msg.receiver_uuid === myUuid) ||
          (msg.sender_uuid === myUuid && msg.receiver_uuid === selectedUser?.uuid)
        ))
      ) {
        setMessages(prev => {
          // 중복 메시지 방지
          if (prev.some(m => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };

    socket.on('chat', handleIncomingMessage);

    return () => {
      socket.off('chat', handleIncomingMessage);
      socket.disconnect();
    };
  }, [token, selectedUser, myUuid, roomUuid]); // roomUuid 의존성 추가

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedUser) return;

    // roomUuid가 "undefined" 문자열인 경우 null로 처리
    const actualRoomUuid = roomUuid && roomUuid !== 'undefined' ? roomUuid : null;

    let msg;
    if (actualRoomUuid) {
      // 그룹 채팅 - room_uuid만 포함
      msg = {
        sender_uuid: myUuid,
        text: newMsg,
        timestamp: new Date().toISOString(),
        room_uuid: actualRoomUuid
      };
    } else {
      // 1:1 채팅 - receiver_uuid만 포함
      msg = {
        sender_uuid: myUuid,
        text: newMsg,
        timestamp: new Date().toISOString(),
        receiver_uuid: selectedUser.uuid
      };
    }

    console.log('📨 전송할 메시지:', msg); // 디버깅 로그
    console.log('🔍 roomUuid 값:', roomUuid); // roomUuid 값 확인
    console.log('🔍 actualRoomUuid 값:', actualRoomUuid); // 처리된 값 확인

    // 메시지 전송 중 표시를 위한 임시 메시지 (로딩 상태)
    const tempMsg = { ...msg, message_id: 'temp-' + Date.now(), isTemp: true };
    setMessages(prev => [...prev, tempMsg]);
    
    const originalMsg = newMsg;
    setNewMsg('');
    scrollToBottom();

    try {
      const response = await axios.post(`${API_BASE}/api/messages`, msg, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 임시 메시지 제거하고 실제 메시지로 교체
      const realMsg = {
        ...msg,
        message_id: response.data.message_id,
        timestamp: response.data.timestamp
      };

      setMessages(prev => 
        prev.filter(m => m.message_id !== tempMsg.message_id).concat(realMsg)
      );

      // 소켓으로 다른 사용자들에게 전송
      socket.emit('chat', { 
        ...realMsg, 
        sender: myName 
      });
      
      scrollToBottom();
    } catch (err) {
      console.error('메시지 저장 실패', err);
      // 실패 시 임시 메시지 제거하고 입력값 복원
      setMessages(prev => prev.filter(m => m.message_id !== tempMsg.message_id));
      setNewMsg(originalMsg);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log(`📤 파일 업로드 시작: ${file.name}, 크기: ${file.size} bytes`);

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      event.target.value = '';
      return;
    }

    // 허용된 파일 확장자 검사
    const allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      alert('허용되지 않는 파일 형식입니다.\n허용 형식: ' + allowedExtensions.join(', '));
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (roomUuid) {
        formData.append('room_uuid', roomUuid);
        console.log(`📤 그룹 채팅방에 파일 업로드: ${roomUuid}`);
      } else {
        formData.append('target_uuid', selectedUser.uuid);
        console.log(`📤 1:1 채팅에 파일 업로드: ${selectedUser.uuid}`);
      }

      console.log('📤 업로드 요청 전송 중...');
      const response = await axios.post(`${API_BASE}/api/upload-file`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30초 타임아웃
      });

      console.log('✅ 업로드 성공:', response.data);

      // 파일 업로드 성공 후 메시지 추가
      const fileMessage = {
        sender_uuid: myUuid,
        text: `📎 파일: ${file.name}`,
        timestamp: new Date().toISOString(),
        room_uuid: roomUuid || undefined,
        receiver_uuid: !roomUuid ? selectedUser.uuid : undefined,
        file_name: file.name,
        file_type: fileExtension,
        message_id: response.data.message_id
      };

      setMessages(prev => [...prev, fileMessage]);
      
      // 소켓으로 파일 메시지 전송
      socket.emit('chat', { 
        ...fileMessage, 
        sender: myName,
        file_info: {
          name: file.name,
          type: fileExtension,
          size: file.size,
          message_id: response.data.message_id
        }
      });
      
      scrollToBottom();
      
      // 파일 입력 초기화
      event.target.value = '';
      
      // 성공 메시지 표시
      console.log(`✅ 파일 "${file.name}" 업로드 완료`);
      
    } catch (error) {
      console.error('❌ 파일 업로드 실패:', error);
      
      let errorMessage = '파일 업로드에 실패했습니다.';
      
      if (error.response) {
        // 서버에서 응답한 에러
        const serverError = error.response.data?.error || error.response.statusText;
        errorMessage = `파일 업로드 실패: ${serverError}`;
        console.error('서버 에러:', error.response.status, serverError);
      } else if (error.request) {
        // 네트워크 에러
        errorMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
        console.error('네트워크 에러:', error.request);
      } else if (error.code === 'ECONNABORTED') {
        // 타임아웃 에러
        errorMessage = '파일 업로드 시간이 초과되었습니다. 파일 크기를 확인하고 다시 시도해주세요.';
      } else {
        console.error('기타 에러:', error.message);
      }
      
      alert(errorMessage);
      event.target.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (messageId, fileName) => {
    try {
      const response = await axios.get(`${API_BASE}/api/download-file/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      // 파일 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!messageId || messageId.toString().startsWith('temp-')) {
      alert('임시 메시지는 삭제할 수 없습니다.');
      setShowDeleteMenu(null);
      return;
    }
    
    const confirmDelete = window.confirm('이 메시지를 삭제하시겠습니까?');
    if (!confirmDelete) {
      // 사용자가 취소한 경우 메뉴 유지
      return;
    }

    setDeleteLoading(true);
    
    try {
      console.log(`🗑️ 메시지 삭제 시도: ID ${messageId}`);
      console.log(`🌐 API 요청 URL: ${API_BASE}/api/delete-message/${messageId}`);
      console.log(`🔑 토큰 존재: ${!!token}`);
      
      const response = await axios.delete(`${API_BASE}/api/delete-message/${messageId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10초 타임아웃
      });

      console.log('✅ 메시지 삭제 성공:', response.data.message);
      
      // 메시지 목록에서 삭제된 메시지 제거
      setMessages(prev => prev.filter(msg => msg.message_id !== messageId));
      
      // 삭제 성공 후 메뉴 숨기기
      setShowDeleteMenu(null);
      
      // 소켓으로 삭제 알림 전송 (다른 사용자들에게 실시간 반영)
      socket.emit('message_deleted', {
        message_id: messageId,
        room_uuid: roomUuid,
        target_uuid: !roomUuid ? selectedUser?.uuid : undefined
      });
      
      console.log('메시지가 삭제되었습니다.');
      
    } catch (error) {
      console.error('❌ 메시지 삭제 실패:', error);
      console.error('❌ 에러 세부사항:', {
        message: error.message,
        code: error.code,
        request: error.request,
        response: error.response,
        config: error.config
      });
      
      let errorMessage = '메시지 삭제에 실패했습니다.';
      
      if (error.response) {
        const status = error.response.status;
        const serverError = error.response.data?.error || error.response.statusText;
        
        switch (status) {
          case 404:
            errorMessage = '삭제하려는 메시지를 찾을 수 없습니다.';
            // 404 에러인 경우 UI에서도 메시지 제거
            setMessages(prev => prev.filter(msg => msg.message_id !== messageId));
            break;
          case 403:
            errorMessage = '본인이 보낸 메시지만 삭제할 수 있습니다.';
            break;
          case 401:
            errorMessage = '로그인이 필요합니다.';
            break;
          default:
            errorMessage = `서버 오류 (${status}): ${serverError}`;
        }
        
        console.error(`서버 에러 ${status}:`, serverError);
      } else if (error.request) {
        console.error('네트워크 에러 상세:', error.request);
        
        if (error.code === 'ECONNABORTED') {
          errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
        } else if (error.code === 'ECONNREFUSED') {
          errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
        } else if (error.code === 'NETWORK_ERROR') {
          errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
        } else {
          errorMessage = `네트워크 연결에 문제가 있습니다. (${error.code || '알 수 없는 오류'})`;
        }
      } else {
        console.error('기타 에러:', error.message);
        errorMessage = `알 수 없는 오류: ${error.message}`;
      }
      
      alert(errorMessage);
      
      // 에러 발생 시에도 메뉴 숨기기
      setShowDeleteMenu(null);
      
    } finally {
      setDeleteLoading(false);
    }
  };

  // 롱 프레스 시작
  const handleMouseDown = (messageId, isMySentMessage) => {
    if (!isMySentMessage) return; // 본인이 보낸 메시지만 삭제 가능
    if (showDeleteMenu === messageId) return; // 이미 메뉴가 표시된 경우 무시
    
    longPressTimer.current = setTimeout(() => {
      setShowDeleteMenu(messageId);
    }, 1000); // 1초 후 메뉴 표시
  };

  // 롱 프레스 취소 - 메뉴가 표시되지 않은 경우에만 타이머 취소
  const handleMouseUp = (messageId) => {
    if (showDeleteMenu === messageId) return; // 메뉴가 이미 표시된 경우 무시
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 마우스가 메시지를 벗어날 때 - 메뉴가 표시되지 않은 경우에만 타이머 취소
  const handleMouseLeave = (messageId) => {
    if (showDeleteMenu === messageId) return; // 메뉴가 이미 표시된 경우 무시
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 터치 이벤트 처리 (모바일 지원)
  const handleTouchStart = (messageId, isMySentMessage) => {
    handleMouseDown(messageId, isMySentMessage);
  };

  const handleTouchEnd = (messageId) => {
    handleMouseUp(messageId);
  };

  // 메뉴 외부 클릭 시 메뉴 닫기 - 삭제/취소 버튼만으로 닫기
  const handleClickOutside = (event) => {
    // 삭제 메뉴나 메시지 버블 내부 클릭은 무시
    if (event.target.closest('.delete-menu') || event.target.closest('.message-bubble')) {
      return;
    }
    // 다른 메시지를 클릭한 경우에만 메뉴 닫기
    setShowDeleteMenu(null);
  };

  const getSenderName = (uuid) => {
    if (uuid === myUuid) return myName;
    // users가 배열인지 확인 후 find 메서드 사용
    if (!Array.isArray(users)) return uuid;
    const user = users.find(u => u.uuid === uuid);
    return user?.name || uuid;
  };

  const scrollToBottom = () => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  };

  const isFileMessage = (text) => {
    return text.startsWith('📎 파일:');
  };

  const isImageFile = (fileName) => {
    if (!fileName) return false;
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
    const extension = fileName.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(extension);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return { date: '', time: '' };
    
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return {
      date: `${year}/${month}/${day}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  };

  const renderMessage = (m, i) => {
    const isMySentMessage = m.sender_uuid === myUuid;
    const { date, time } = formatTimestamp(m.timestamp);
    
    return (
      <div key={i} className={`message-row ${isMySentMessage ? 'sent' : 'received'}`}>
        {/* 받은 메시지의 경우 왼쪽에 보낸 사람 이름 */}
        {!isMySentMessage && (
          <div className="sender-info">
            <div className="sender-name">{getSenderName(m.sender_uuid)}</div>
          </div>
        )}
        
        <div className="message-content">
          <div 
            className="message-bubble"
            onMouseDown={() => handleMouseDown(m.message_id, isMySentMessage)}
            onMouseUp={() => handleMouseUp(m.message_id)}
            onMouseLeave={() => handleMouseLeave(m.message_id)}
            onTouchStart={() => handleTouchStart(m.message_id, isMySentMessage)}
            onTouchEnd={() => handleTouchEnd(m.message_id)}
            style={{ position: 'relative', cursor: isMySentMessage ? 'pointer' : 'default' }}
          >
            {isFileMessage(m.text) ? (
              <div className="file-message">
                {isImageFile(m.file_name) ? (
                  <div className="image-message">
                    <img 
                      src={`${API_BASE}/api/download-file/${m.message_id}?t=${Date.now()}`}
                      alt={m.file_name || m.text.replace('📎 파일: ', '')}
                      className="message-image"
                      crossOrigin="anonymous"
                      onLoad={(e) => {
                        console.log('✅ 이미지 로드 성공:', e.target.src);
                      }}
                      onError={(e) => {
                        console.error('❌ 이미지 로드 실패:', e.target.src);
                        console.log('Authorization 헤더로 다시 시도...');
                        
                        // Authorization 헤더와 함께 fetch로 이미지 다시 로드
                        fetch(`${API_BASE}/api/download-file/${m.message_id}`, {
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        })
                        .then(response => {
                          if (response.ok) {
                            return response.blob();
                          }
                          throw new Error('이미지 로드 실패');
                        })
                        .then(blob => {
                          const imageUrl = URL.createObjectURL(blob);
                          e.target.src = imageUrl;
                          console.log('✅ Authorization으로 이미지 로드 성공');
                        })
                        .catch(error => {
                          console.error('❌ Authorization으로도 실패:', error);
                          // 완전 실패 시 다운로드 버튼으로 대체
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        });
                      }}
                    />
                    <div className="image-fallback" style={{ display: 'none' }}>
                      <div className="file-icon">🖼️</div>
                      <div className="file-info">
                        <div className="file-name">{m.file_name || m.text.replace('📎 파일: ', '')}</div>
                        {m.message_id && (
                          <button 
                            className="download-btn"
                            onClick={() => handleDownloadFile(m.message_id, m.file_name || m.text.replace('📎 파일: ', ''))}
                          >
                            다운로드
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="non-image-file">
                    <div className="file-icon">📎</div>
                    <div className="file-info">
                      <div className="file-name">{m.file_name || m.text.replace('📎 파일: ', '')}</div>
                      {m.message_id && (
                        <button 
                          className="download-btn"
                          onClick={() => handleDownloadFile(m.message_id, m.file_name || m.text.replace('📎 파일: ', ''))}
                        >
                          다운로드
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="message-text">{m.text}</div>
            )}
            
            {/* 삭제 메뉴 */}
            {showDeleteMenu === m.message_id && isMySentMessage && (
              <div 
                className="delete-menu" 
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                }}
              >
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMessage(m.message_id);
                  }}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? '삭제 중...' : '🗑️ 삭제'}
                </button>
                <button 
                  className="cancel-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteMenu(null);
                  }}
                >
                  취소
                </button>
              </div>
            )}
          </div>
          
          {/* 타임스탬프를 메시지 버블 밖으로 */}
          <div className="timestamp-container">
            <div className="timestamp-date">{date}</div>
            <div className="timestamp-time">{time}</div>
          </div>
        </div>
        
        {/* 보낸 메시지의 경우 오른쪽에 보낸 사람 이름 */}
        {isMySentMessage && (
          <div className="sender-info">
            <div className="sender-name">{getSenderName(m.sender_uuid)}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-container" onClick={handleClickOutside}>
      <main className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <button 
                className="back-to-main-btn" 
                onClick={() => window.location.href = '/main'}
                title="메인 화면으로 돌아가기"
              >
                ← 메인
              </button>
              <h3>{selectedUser.name}님과 대화 중</h3>
            </div>
            <div className="chat-messages" ref={chatLogRef}>
              {messages.map(renderMessage)}
            </div>
            <div className="chat-input-bar">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".txt,.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
              />
              <button 
                className="file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="파일 업로드"
              >
                {uploading ? '📤' : '📎'}
              </button>
              <input
                type="text"
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="메시지를 입력하세요"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleSend();
                  }
                }}
              />
              <button onClick={handleSend}>전송</button>
            </div>
          </>
        ) : (
          <div className="chat-placeholder">
            대화를 시작할 사용자를 선택하세요.
          </div>
        )}
      </main>
    </div>
  );
}

export default MessagePage;