# Hi_Msg - 사내 메신저 시스템

> 일경험 프로젝트 | 내부망 기반 실시간 사내 메신저

## 프로젝트 소개

**Hi_Msg**는 하이세미코 사내 직원들을 위한 실시간 메신저 시스템입니다.
카카오톡의 핵심 기능을 모티브로 하여, 1:1 채팅 및 그룹 채팅, 파일 전송, 관리자 대시보드 등의 기능을 제공합니다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React 19, React Router v7, Axios, Socket.IO Client |
| **Backend** | Flask, Flask-SocketIO, SQLAlchemy, Flask-JWT-Extended |
| **Database** | MySQL |
| **Real-time** | Socket.IO (WebSocket, Gevent) |
| **Authentication** | JWT, Bcrypt |

## 주요 기능

### 메신저
- 1:1 실시간 채팅 (WebSocket 기반)
- 그룹 채팅방 생성 및 대화
- 읽음 확인 (1:1 / 그룹 각각 지원)
- 메시지 삭제
- 채팅방 목록 및 안 읽은 메시지 수 표시

### 파일 전송
- 이미지, 문서 등 13종 파일 형식 지원 (png, jpg, pdf, docx, xlsx, pptx, zip 등)
- 최대 10MB 업로드
- 이미지 인라인 미리보기 / 파일 다운로드

### 사용자 관리
- 회원가입 → 관리자 승인 후 사용 가능
- 비밀번호 재설정 요청 (관리자 승인 방식)
- 사용자 프로필 (이름, 사번, 부서, 직급 등)

### 관리자 기능
- 가입 승인 / 거절
- 비밀번호 재설정 요청 처리
- 사용자 삭제 (채팅 로그 자동 백업)

## 프로젝트 구조

```
work_experience/
├── backend/
│   ├── app.py              # Flask-SocketIO 서버 진입점
│   ├── db.py               # SQLAlchemy DB 초기화
│   ├── models.py           # DB 모델 (User, Message, ChatRoom 등)
│   ├── routes.py           # REST API 라우트
│   ├── sockets.py          # WebSocket 이벤트 핸들러
│   ├── requirements.txt    # Python 의존성
│   └── migrations/         # Alembic DB 마이그레이션
├── frontend/
│   ├── public/             # 정적 파일
│   └── src/
│       ├── App.jsx         # 라우터 설정
│       ├── socket.js       # Socket.IO 클라이언트 설정
│       ├── pages/          # 페이지 컴포넌트
│       └── styles/         # CSS 스타일
└── img/
    └── hisemico.png        # 로고 이미지
```

## 환경 설정

### 사전 준비

**macOS**
```bash
brew install node python@3.11 mysql git
brew services start mysql
```

**Windows**
- [Node.js](https://nodejs.org/)
- [Python 3.11](https://www.python.org/downloads/)
- [MySQL](https://dev.mysql.com/downloads/installer/)
- [Git](https://git-scm.com/download/win)

### 실행 방법

**1. MySQL 데이터베이스 생성**
```sql
CREATE DATABASE hi_msg_db;
```

**2. Backend 실행**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**3. Frontend 실행**
```bash
cd frontend
npm install
npm start
```

**4. 환경 변수 (.env)**
```
REACT_APP_API_BASE=http://localhost:5050
REACT_APP_REA_BASE=http://localhost:3000
FLASK_SECRET_KEY=your_secret_key
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/register` | 회원가입 |
| POST | `/api/login` | 로그인 |
| GET | `/api/users` | 전체 사용자 조회 |
| GET | `/api/users/me` | 내 정보 조회 |
| PUT | `/api/users/me/password` | 비밀번호 변경 |
| GET | `/api/messages/<uuid>` | 1:1 메시지 조회 |
| POST | `/api/messages` | 메시지 전송 |
| DELETE | `/api/messages/<id>` | 메시지 삭제 |
| GET | `/api/chat-rooms` | 채팅방 목록 |
| POST | `/api/create-chat-room` | 그룹 채팅방 생성 |
| POST | `/api/upload-file` | 파일 업로드 |
| GET | `/api/download-file/<id>` | 파일 다운로드 |
| GET | `/api/pending-users` | 승인 대기 사용자 (관리자) |
| PUT | `/api/approve-user/<id>` | 사용자 승인 (관리자) |
| PUT | `/api/reject-user/<id>` | 사용자 거절 (관리자) |
| DELETE | `/api/delete-user/<id>` | 사용자 삭제 (관리자) |
