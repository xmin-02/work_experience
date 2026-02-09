# models.py
from db import db
from datetime import datetime
import uuid

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    user_uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(50), nullable=False)
    employee_id = db.Column(db.String(20), unique=True, nullable=False)
    birth_date = db.Column(db.Date)
    position = db.Column(db.String(50))
    grade = db.Column(db.String(50))
    department = db.Column(db.String(50))
    email = db.Column(db.String(100), unique=True, nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    is_approved = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_rejected = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy=True)
    received_messages = db.relationship('Message', foreign_keys='Message.receiver_id', backref='receiver', lazy=True)

class Message(db.Model):
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)  # ← 수정
    sender_uuid = db.Column(db.String(255), nullable=False)
    receiver_uuid = db.Column(db.String(255), nullable=True)  # ← 수정
    room_uuid = db.Column(db.String(64), db.ForeignKey('chat_room.room_uuid'), nullable=True)

    message_text = db.Column(db.Text)
    image_path = db.Column(db.String(500))
    file_path = db.Column(db.String(500))
    file_name = db.Column(db.String(255))  # 원본 파일명
    file_type = db.Column(db.String(20))   # 파일 확장자
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
class MessageRead(db.Model):
    __tablename__ = 'message_reads'
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), primary_key=True)
    reader_uuid = db.Column(db.String(64), db.ForeignKey('users.user_uuid'), primary_key=True)
    read_at = db.Column(db.DateTime, default=datetime.utcnow)

class Admin(db.Model):
    __tablename__ = 'admins'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    grade = db.Column(db.String(50))
    email = db.Column(db.String(100), nullable=False)

class ChatRoom(db.Model):
    __tablename__ = 'chat_room'

    id = db.Column(db.Integer, primary_key=True)
    room_uuid = db.Column(db.String(64), unique=True, nullable=False)
    is_group = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    name = db.Column(db.String(255))  # ✅ 길이 지정

    members = db.relationship('ChatRoomMember', backref='chat_room', cascade="all, delete-orphan", lazy=True)
    messages = db.relationship('Message', backref='chat_room', lazy=True, foreign_keys='Message.room_uuid', primaryjoin='ChatRoom.room_uuid==Message.room_uuid')

class ChatRoomMember(db.Model):
    __tablename__ = 'chat_room_member'

    id = db.Column(db.Integer, primary_key=True)
    room_uuid = db.Column(db.String(64), db.ForeignKey('chat_room.room_uuid', ondelete='CASCADE'), nullable=False)
    user_uuid = db.Column(db.String(64), db.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False)

class PasswordResetRequest(db.Model):
    __tablename__ = 'password_reset_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    employee_id = db.Column(db.String(20), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    user_uuid = db.Column(db.String(36), db.ForeignKey('users.user_uuid'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, nullable=True)
    processed_by = db.Column(db.String(36), nullable=True)  # 처리한 관리자 UUID
    
    # 관계 정의
    user = db.relationship('User', backref=db.backref('password_reset_requests', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'employee_id': self.employee_id,
            'department': self.department,
            'user_uuid': self.user_uuid,
            'status': self.status,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'processed_by': self.processed_by
        }

class GroupChatReadStatus(db.Model):
    __tablename__ = 'group_chat_read_status'
    
    id = db.Column(db.Integer, primary_key=True)
    user_uuid = db.Column(db.String(36), db.ForeignKey('users.user_uuid'), nullable=False)
    room_uuid = db.Column(db.String(64), db.ForeignKey('chat_room.room_uuid'), nullable=False)
    last_read_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 복합 고유 제약 조건 (한 사용자당 한 채팅방에 하나의 읽음 상태)
    __table_args__ = (db.UniqueConstraint('user_uuid', 'room_uuid', name='unique_user_room_read'),)