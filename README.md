# 💬 Hi_Msg - Corporate Instant Messenger

![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![Flask](https://img.shields.io/badge/Flask-3.1-000000.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-5.5-010101.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1.svg)

**Hi_Msg** is a real-time corporate messenger built for internal network environments.
Inspired by KakaoTalk's core UX, it provides 1:1 and group chat, file sharing, read receipts, and an admin dashboard — all running on a Flask + React stack with WebSocket communication.

---

## ✨ Key Features

### 💬 Messaging
- **1:1 Real-time Chat** — WebSocket-based instant messaging with Socket.IO
- **Group Chat** — Create named group rooms, invite multiple members
- **Read Receipts** — Per-message read status for both 1:1 and group conversations
- **Message Deletion** — Sender can delete own messages (attached files auto-removed)
- **Unread Counter** — Badge count for unread messages per chat room

### 📎 File Transfer
- **14 File Types** — png, jpg, jpeg, gif, pdf, doc, docx, xls, xlsx, ppt, pptx, zip, rar, txt
- **10MB Limit** — Server-side file size validation
- **Inline Preview** — Images render directly in chat; documents download on click

### 👤 User Management
- **Admin-Approved Signup** — Registration requires admin approval before access
- **Password Reset Flow** — 3-step process: request → admin approval → reset
- **Employee Profile** — Name, employee ID, department, position, grade, email

### 🛡️ Admin Dashboard
- **Signup Approval / Rejection** — Manage pending registrations
- **Password Reset Processing** — Approve or reject reset requests
- **User Deletion with Backup** — Chat logs auto-exported to `deleted_user_logs/` before removal

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router v7, Axios, Socket.IO Client |
| **Backend** | Flask 3.1, Flask-SocketIO, SQLAlchemy, Gevent |
| **Database** | MySQL 8.0 (Alembic migrations) |
| **Real-time** | Socket.IO (WebSocket transport, Gevent async) |
| **Auth** | JWT (Flask-JWT-Extended, 1h expiry), SHA-256 password hashing |

---

## 🏗️ Architecture

```
React 19 (SPA)                     Flask-SocketIO Server (:5050)
┌──────────────┐                   ┌─────────────────────────┐
│  LoginPage   │   REST API        │  routes.py (Blueprint)  │
│  MainPage    │ ──────────────►   │    /api/register        │
│  MessagePage │   (Axios)         │    /api/login           │
│  AdminPage   │                   │    /api/messages        │
│  Mypage      │   WebSocket       │    /api/upload-file     │
│  GroupPage   │ ◄────────────►    │  sockets.py             │
└──────────────┘   (Socket.IO)     │    chat / authenticate  │
                                   ├─────────────────────────┤
                                   │  models.py (SQLAlchemy) │
                                   │    User, Message,       │
                                   │    ChatRoom, ChatMember │
                                   └────────┬────────────────┘
                                            │
                                      ┌─────▼─────┐
                                      │  MySQL DB  │
                                      │ hi_msg_db  │
                                      └───────────┘
```

---

## 📁 Project Structure

```
work_experience/
├── backend/
│   ├── app.py              # Flask-SocketIO entry point (port 5050)
│   ├── db.py               # SQLAlchemy instance
│   ├── models.py           # ORM models (7 tables)
│   ├── routes.py           # REST API routes (20+ endpoints)
│   ├── sockets.py          # WebSocket event handlers
│   ├── requirements.txt    # Python dependencies
│   └── migrations/         # Alembic DB migrations
├── frontend/
│   ├── public/             # Static assets
│   └── src/
│       ├── App.jsx         # React Router config (10 routes)
│       ├── socket.js       # Socket.IO client setup
│       ├── pages/          # 11 page components
│       └── styles/         # Per-page CSS modules
├── img/
│   └── hisemico.png        # Company logo
└── .env                    # Environment variables
```

---

## 🚀 Getting Started

### Prerequisites

| Software | Version |
|----------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| MySQL | 8.0+ |

### Installation

**1. Create Database**
```sql
CREATE DATABASE hi_msg_db;
```

**2. Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**3. Frontend**
```bash
cd frontend
npm install
npm start
```

**4. Environment Variables** (`.env` at project root)
```
REACT_APP_API_BASE=http://localhost:5050
REACT_APP_REA_BASE=http://localhost:3000
FLASK_SECRET_KEY=your_secret_key
```

---

## 🌐 API Endpoints

### Auth & Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | User registration (pending approval) |
| `POST` | `/api/login` | Login, returns JWT token |
| `GET` | `/api/users` | List all approved users |
| `GET` | `/api/users/me` | Current user profile |
| `PUT` | `/api/users/me/password` | Change password |

### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/messages/<uuid>` | Get 1:1 message history |
| `POST` | `/api/messages` | Send message (1:1 or group) |
| `DELETE` | `/api/messages/<id>` | Delete own message |

### Chat Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat-rooms` | List all chat rooms (1:1 + group) |
| `POST` | `/api/create-chat-room` | Create group chat room |
| `GET` | `/api/chat-rooms/<uuid>` | Get group chat messages + members |
| `POST` | `/api/chat-rooms/<uuid>/mark-read` | Mark group messages as read |
| `DELETE` | `/api/delete-chat-room/<id>` | Delete chat room (logs backed up) |

### File Transfer

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload-file` | Upload file (max 10MB, 14 types) |
| `GET` | `/api/download-file/<id>` | Download or inline-preview file |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pending-users` | List pending registrations |
| `PUT` | `/api/approve-user/<id>` | Approve user signup |
| `PUT` | `/api/reject-user/<id>` | Reject user signup |
| `DELETE` | `/api/delete-user/<id>` | Delete user (chat logs backed up) |

### Password Reset

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/password-reset/request` | Submit reset request |
| `POST` | `/api/password-reset/status` | Check request status |
| `PUT` | `/api/password-reset/approve/<id>` | Admin approves reset |
| `PUT` | `/api/password-reset/reject/<id>` | Admin rejects reset |
| `POST` | `/api/password-reset/reset` | Execute password reset |

---

## 🔌 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client → Server | Initial connection |
| `authenticate` | Client → Server | JWT token verification |
| `chat` | Bidirectional | Send/receive messages |
| `new_message` | Server → Client | New message notification |
| `group_message` | Server → Client | Group chat message alert |
| `user_list` | Server → Client | Online user list broadcast |
| `disconnect` | Client → Server | Connection teardown |

---

## 📊 Database Schema

| Table | Description |
|-------|-------------|
| `users` | Employee profiles, auth credentials, approval status |
| `messages` | Chat messages with optional file attachments |
| `message_reads` | 1:1 message read receipts |
| `chat_room` | Group chat room metadata |
| `chat_room_member` | Group membership (M:N relation) |
| `password_reset_requests` | Admin-managed password reset workflow |
| `group_chat_read_status` | Per-user read timestamp per group room |

---

---

# 💬 Hi_Msg - 사내 메신저 시스템

![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![Flask](https://img.shields.io/badge/Flask-3.1-000000.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-5.5-010101.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1.svg)

**Hi_Msg**는 하이세미코 사내 직원들을 위한 실시간 메신저 시스템입니다.
카카오톡의 핵심 UX를 모티브로 하여, 1:1 채팅 및 그룹 채팅, 파일 전송, 읽음 확인, 관리자 대시보드를 제공합니다.
Flask + React 스택 위에 WebSocket 실시간 통신으로 구동됩니다.

---

## ✨ 주요 기능

### 💬 메신저
- **1:1 실시간 채팅** — Socket.IO 기반 WebSocket 즉시 메시징
- **그룹 채팅** — 이름 지정 그룹방 생성, 다수 멤버 초대
- **읽음 확인** — 1:1 및 그룹 대화 모두 메시지별 읽음 상태 추적
- **메시지 삭제** — 본인 메시지 삭제 가능 (첨부 파일 자동 제거)
- **안 읽은 메시지 카운터** — 채팅방별 안 읽은 메시지 수 배지 표시

### 📎 파일 전송
- **14종 파일 형식** — png, jpg, jpeg, gif, pdf, doc, docx, xls, xlsx, ppt, pptx, zip, rar, txt
- **10MB 제한** — 서버 측 파일 크기 검증
- **인라인 미리보기** — 이미지는 채팅에서 바로 표시, 문서는 클릭 시 다운로드

### 👤 사용자 관리
- **관리자 승인 가입** — 회원가입 후 관리자 승인 필요
- **비밀번호 재설정 플로우** — 요청 → 관리자 승인 → 재설정 3단계
- **직원 프로필** — 이름, 사번, 부서, 직급, 등급, 이메일

### 🛡️ 관리자 대시보드
- **가입 승인 / 거절** — 대기 중인 가입 요청 관리
- **비밀번호 재설정 처리** — 재설정 요청 승인 또는 거부
- **사용자 삭제 (로그 백업)** — 삭제 전 채팅 로그 자동 `deleted_user_logs/`에 저장

---

## 🔧 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | React 19, React Router v7, Axios, Socket.IO Client |
| **백엔드** | Flask 3.1, Flask-SocketIO, SQLAlchemy, Gevent |
| **데이터베이스** | MySQL 8.0 (Alembic 마이그레이션) |
| **실시간 통신** | Socket.IO (WebSocket 전송, Gevent 비동기) |
| **인증** | JWT (Flask-JWT-Extended, 1시간 만료), SHA-256 비밀번호 해싱 |

---

## 🏗️ 아키텍처

```
React 19 (SPA)                     Flask-SocketIO 서버 (:5050)
┌──────────────┐                   ┌─────────────────────────┐
│  LoginPage   │   REST API        │  routes.py (Blueprint)  │
│  MainPage    │ ──────────────►   │    /api/register        │
│  MessagePage │   (Axios)         │    /api/login           │
│  AdminPage   │                   │    /api/messages        │
│  Mypage      │   WebSocket       │    /api/upload-file     │
│  GroupPage   │ ◄────────────►    │  sockets.py             │
└──────────────┘   (Socket.IO)     │    chat / authenticate  │
                                   ├─────────────────────────┤
                                   │  models.py (SQLAlchemy) │
                                   │    User, Message,       │
                                   │    ChatRoom, ChatMember │
                                   └────────┬────────────────┘
                                            │
                                      ┌─────▼─────┐
                                      │  MySQL DB  │
                                      │ hi_msg_db  │
                                      └───────────┘
```

---

## 📁 프로젝트 구조

```
work_experience/
├── backend/
│   ├── app.py              # Flask-SocketIO 서버 진입점 (포트 5050)
│   ├── db.py               # SQLAlchemy 인스턴스
│   ├── models.py           # ORM 모델 (7개 테이블)
│   ├── routes.py           # REST API 라우트 (20+ 엔드포인트)
│   ├── sockets.py          # WebSocket 이벤트 핸들러
│   ├── requirements.txt    # Python 의존성
│   └── migrations/         # Alembic DB 마이그레이션
├── frontend/
│   ├── public/             # 정적 파일
│   └── src/
│       ├── App.jsx         # React Router 설정 (10개 라우트)
│       ├── socket.js       # Socket.IO 클라이언트 설정
│       ├── pages/          # 11개 페이지 컴포넌트
│       └── styles/         # 페이지별 CSS 모듈
├── img/
│   └── hisemico.png        # 회사 로고
└── .env                    # 환경 변수
```

---

## 🚀 시작하기

### 사전 준비

| 소프트웨어 | 버전 |
|-----------|------|
| Node.js | 18+ |
| Python | 3.11+ |
| MySQL | 8.0+ |

### 설치 방법

**1. 데이터베이스 생성**
```sql
CREATE DATABASE hi_msg_db;
```

**2. 백엔드 실행**
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**3. 프론트엔드 실행**
```bash
cd frontend
npm install
npm start
```

**4. 환경 변수** (프로젝트 루트 `.env`)
```
REACT_APP_API_BASE=http://localhost:5050
REACT_APP_REA_BASE=http://localhost:3000
FLASK_SECRET_KEY=your_secret_key
```

---

## 🌐 API 엔드포인트

### 인증 & 사용자

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/register` | 회원가입 (승인 대기) |
| `POST` | `/api/login` | 로그인, JWT 토큰 반환 |
| `GET` | `/api/users` | 승인된 전체 사용자 조회 |
| `GET` | `/api/users/me` | 현재 사용자 프로필 |
| `PUT` | `/api/users/me/password` | 비밀번호 변경 |

### 메시징

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/messages/<uuid>` | 1:1 메시지 내역 조회 |
| `POST` | `/api/messages` | 메시지 전송 (1:1 또는 그룹) |
| `DELETE` | `/api/messages/<id>` | 본인 메시지 삭제 |

### 채팅방

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/chat-rooms` | 전체 채팅방 목록 (1:1 + 그룹) |
| `POST` | `/api/create-chat-room` | 그룹 채팅방 생성 |
| `GET` | `/api/chat-rooms/<uuid>` | 그룹 채팅 메시지 + 멤버 조회 |
| `POST` | `/api/chat-rooms/<uuid>/mark-read` | 그룹 메시지 읽음 표시 |
| `DELETE` | `/api/delete-chat-room/<id>` | 채팅방 삭제 (로그 백업) |

### 파일 전송

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/upload-file` | 파일 업로드 (최대 10MB, 14종) |
| `GET` | `/api/download-file/<id>` | 파일 다운로드 또는 인라인 미리보기 |

### 관리자

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/pending-users` | 승인 대기 사용자 목록 |
| `PUT` | `/api/approve-user/<id>` | 사용자 가입 승인 |
| `PUT` | `/api/reject-user/<id>` | 사용자 가입 거절 |
| `DELETE` | `/api/delete-user/<id>` | 사용자 삭제 (채팅 로그 백업) |

### 비밀번호 재설정

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/password-reset/request` | 재설정 요청 제출 |
| `POST` | `/api/password-reset/status` | 요청 상태 확인 |
| `PUT` | `/api/password-reset/approve/<id>` | 관리자 승인 |
| `PUT` | `/api/password-reset/reject/<id>` | 관리자 거부 |
| `POST` | `/api/password-reset/reset` | 비밀번호 재설정 실행 |

---

## 🔌 WebSocket 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `connect` | Client → Server | 초기 연결 |
| `authenticate` | Client → Server | JWT 토큰 인증 |
| `chat` | 양방향 | 메시지 송수신 |
| `new_message` | Server → Client | 새 메시지 알림 |
| `group_message` | Server → Client | 그룹 채팅 메시지 알림 |
| `user_list` | Server → Client | 접속 사용자 목록 브로드캐스트 |
| `disconnect` | Client → Server | 연결 해제 |

---

## 📊 데이터베이스 스키마

| 테이블 | 설명 |
|--------|------|
| `users` | 직원 프로필, 인증 정보, 승인 상태 |
| `messages` | 채팅 메시지 (파일 첨부 포함) |
| `message_reads` | 1:1 메시지 읽음 확인 |
| `chat_room` | 그룹 채팅방 메타데이터 |
| `chat_room_member` | 그룹 멤버십 (M:N 관계) |
| `password_reset_requests` | 관리자 기반 비밀번호 재설정 워크플로우 |
| `group_chat_read_status` | 그룹방별 사용자 읽음 타임스탬프 |
