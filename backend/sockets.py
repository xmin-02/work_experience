# sockets.py
from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import SocketIO
from models import User
from db import db  # app 대신 db를 직접 import

connected_users = {}  # {sid: uuid}
uuid_to_sid = {}      # {uuid: sid}

def register_socket_events(socketio: SocketIO):
    @socketio.on('connect')
    def handle_connect():
        print("✅ 클라이언트 연결됨")

    @socketio.on('authenticate')
    def handle_auth(data):
        token = data.get('token')
        try:
            decoded = decode_token(token)
            user_uuid = decoded['sub']
            sid = request.sid
            connected_users[sid] = user_uuid
            uuid_to_sid[user_uuid] = sid

            print(f"🟢 인증된 유저: {user_uuid}")

            # 접속 사용자 목록 전달
            with db.session() as session:
                user_list = session.query(User.name, User.user_uuid, User.department).filter(
                    User.user_uuid.in_(connected_users.values())
                ).all()

                socketio.emit('user_list', [
                    {'uuid': u.user_uuid, 'name': u.name, 'department': u.department}
                    for u in user_list
                ])
        except Exception as e:
            print("❌ 인증 실패:", e)

    @socketio.on('chat')
    def handle_chat(data):
        print(f"💬 메시지 수신: {data}")
        receiver_uuid = data.get('receiver_uuid')
        sender_uuid = data.get('sender_uuid')
        room_uuid = data.get('room_uuid')  # 그룹 채팅 지원
        
        if room_uuid:
            # 그룹 채팅 메시지 처리
            print(f"📨 그룹 채팅 메시지: room_uuid={room_uuid}, sender_uuid={sender_uuid}")
            
            # 해당 그룹의 모든 멤버에게 메시지 전송
            from models import ChatRoomMember
            with db.session() as session:
                members = session.query(ChatRoomMember.user_uuid).filter(
                    ChatRoomMember.room_uuid == room_uuid
                ).all()
                
                for member in members:
                    member_sid = uuid_to_sid.get(member.user_uuid)
                    if member_sid:
                        socketio.emit('chat', data, to=member_sid)
                        # 그룹 메시지 알림 전송
                        socketio.emit('new_message', {
                            'sender_uuid': sender_uuid, 
                            'room_uuid': room_uuid
                        }, to=member_sid)
                        socketio.emit('group_message', {
                            'room_uuid': room_uuid, 
                            'sender_uuid': sender_uuid
                        }, to=member_sid)
        else:
            # 1:1 채팅 메시지 처리 (기존 로직)
            receiver_sid = uuid_to_sid.get(receiver_uuid)
            
            if receiver_sid:
                socketio.emit('chat', data, to=receiver_sid)  # 🔥 수신자에게만 전송
                socketio.emit('new_message', {'sender_uuid': sender_uuid}, to=receiver_sid)  # ✅ 추가

            sender_sid = uuid_to_sid.get(data.get('sender_uuid'))
            if sender_sid and sender_sid != receiver_sid:
                socketio.emit('chat', data, to=sender_sid)  # 🔥 본인에게도 전송

    @socketio.on('disconnect')
    def handle_disconnect():
        sid = request.sid
        disconnected_uuid = connected_users.pop(sid, None)

        if disconnected_uuid:
            uuid_to_sid.pop(disconnected_uuid, None)
        print(f"🔴 연결 해제: {disconnected_uuid}")

        # 접속 사용자 목록 갱신
        with db.session() as session:
            user_list = session.query(User.name, User.user_uuid, User.department).filter(
                User.user_uuid.in_(connected_users.values())
            ).all()

            socketio.emit('user_list', [
                {'uuid': u.user_uuid, 'name': u.name, 'department': u.department}
                for u in user_list
            ])
