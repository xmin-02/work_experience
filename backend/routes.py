from flask import request, jsonify, Blueprint, send_file
from flask_cors import cross_origin
from db import db
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from datetime import datetime, timedelta
import hashlib
import uuid
import sys
import os
from dotenv import load_dotenv
from sqlalchemy import or_, desc, func
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Message, MessageRead, ChatRoom, ChatRoomMember, PasswordResetRequest, GroupChatReadStatus
import hashlib
from werkzeug.utils import secure_filename

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))
base_url = os.environ.get('REACT_APP_REA_BASE')
if not base_url:
    raise ValueError("❌ REACT_APP_REA_BASE 환경 변수가 설정되지 않았습니다.")

# ✅ Blueprint 선언
user_bp = Blueprint('user_bp', __name__)

# ✅ Blueprint 라우트 정의

@user_bp.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user_uuid = get_jwt_identity()
    users = User.query.filter_by(is_approved=True, is_rejected=False).all()
    user_list = [
        {
            "id": u.id,
            "uuid": u.user_uuid,
            "name": u.name,
            "username": u.username,
            "position": u.position,
            "department": getattr(u, 'department', None),
            "is_admin": u.is_admin
        } for u in users
    ]
    return jsonify(user_list)  # 직접 배열 반환
    
# ✅ 현재 사용자 정보 조회
@user_bp.route('/api/users/me', methods=['GET'])
@jwt_required()
def get_my_info():
    current_uuid = get_jwt_identity()
    user = User.query.filter_by(user_uuid=current_uuid).first()
    if not user:
        return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

    return jsonify({
        'uuid': user.user_uuid,
        'name': user.name,
        'employee_id': user.employee_id,
        'department': user.department,
        'position': user.position,
        'grade': user.grade,
        'email': user.email,
        'username': user.username,
        'is_admin': user.is_admin
    })

# ✅ 비밀번호 변경
@user_bp.route('/api/users/me/password', methods=['PUT'])
@jwt_required()
def change_password():
    current_uuid = get_jwt_identity()
    user = User.query.filter_by(user_uuid=current_uuid).first()
    if not user:
        return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

    data = request.get_json()
    current_pw = data.get('current_password')
    new_pw = data.get('new_password')

    if not current_pw or not new_pw:
        return jsonify({'error': '비밀번호가 입력되지 않았습니다.'}), 400

    current_hash = hashlib.sha256(current_pw.encode()).hexdigest()
    if user.password_hash != current_hash:
        return jsonify({'error': '현재 비밀번호가 일치하지 않습니다.'}), 401

    user.password_hash = hashlib.sha256(new_pw.encode()).hexdigest()
    db.session.commit()
    return jsonify({'message': '비밀번호가 변경되었습니다.'}), 200


# ✅ register_routes 함수
def register_routes(app):
    app.register_blueprint(user_bp)

    @app.route('/api/register', methods=['POST', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['POST', 'OPTIONS'])
    def register_user():
        try:
            data = request.get_json()
            if User.query.filter_by(username=data['username']).first():
                return jsonify({'error': '이미 사용 중인 아이디입니다.'}), 400
            if User.query.filter_by(email=data['email']).first():
                return jsonify({'error': '이미 등록된 이메일입니다.'}), 400
            if User.query.filter_by(employee_id=data['employee_id']).first():
                return jsonify({'error': '이미 등록된 사번입니다.'}), 400

            password_hash = hashlib.sha256(data['password'].encode()).hexdigest()
            new_user = User(
                user_uuid=str(uuid.uuid4()),
                name=data['name'],
                employee_id=data['employee_id'],
                birth_date=data['birth_date'],
                position=data['position'],
                grade=data['grade'],
                department=data['department'],
                email=data['email'],
                username=data['username'],
                password_hash=password_hash,
                is_approved=False
            )
            db.session.add(new_user)
            db.session.commit()

            return jsonify({'message': '가입 요청이 완료되었습니다. 관리자 승인을 기다려주세요.'}), 201

        except Exception as e:
            print("❌ 에러 발생:", str(e), file=sys.stderr)
            return jsonify({'error': '서버 오류 발생'}), 500
        
    @app.route('/api/delete-user/<int:user_id>', methods=['DELETE'])
    @jwt_required()
    def delete_user(user_id):
        current_user = User.query.filter_by(user_uuid=get_jwt_identity()).first()
        if not current_user or not current_user.is_admin:
            return jsonify({'error': '관리자만 삭제할 수 있습니다.'}), 403

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

        # ✅ 사용자 이름/사번 기반 폴더 생성
        user_folder = f"{user.name}_{user.employee_id}"
        base_path = os.path.join("deleted_user_logs", user_folder)
        os.makedirs(base_path, exist_ok=True)

        # ✅ 사용자가 참여한 모든 메시지 가져오기
        messages = Message.query.filter(
            (Message.sender_id == user.id) | (Message.receiver_id == user.id)
        ).order_by(Message.timestamp.asc()).all()

        # ✅ 메시지를 채팅 상대방별로 분류
        logs = {}
        for msg in messages:
            if msg.sender_id == user.id:
                other_id = msg.receiver_id
                direction = '→'
            else:
                other_id = msg.sender_id
                direction = '←'

            if other_id not in logs:
                other_user = User.query.get(other_id)
                if not other_user:
                    continue
                logs[other_id] = {
                    "filename": f"{user.name}-{other_user.name}.txt",
                    "lines": []
                }

            logs[other_id]["lines"].append(
                f"[{msg.timestamp}] {direction} {msg.message_text}"
            )

        # ✅ 파일 저장
        for other_id, log in logs.items():
            log_path = os.path.join(base_path, log["filename"])
            with open(log_path, 'w', encoding='utf-8') as f:
                for line in log["lines"]:
                    f.write(line + "\n")

        # ✅ 메시지 먼저 삭제
        for msg in messages:
            db.session.delete(msg)

        # ✅ 사용자 삭제
        db.session.delete(user)
        db.session.commit()

        return jsonify({'message': '사용자 삭제 및 모든 기록 백업 완료'}), 200

    @app.route('/api/login', methods=['POST'])
    @cross_origin(origins=base_url, methods=['POST', 'OPTIONS'])
    def login_user():
        try:
            data = request.get_json()
            username = data.get('username')
            password = data.get('password')

            user = User.query.filter_by(username=username).first()
            if not user:
                return jsonify({'error': '존재하지 않는 사용자입니다.'}), 401

            if user.is_rejected:
                db.session.delete(user)
                db.session.commit()
                return jsonify({'error': '회원가입이 반려되었습니다. 다시 회원가입해주세요.'}), 403

            password_hash = hashlib.sha256(password.encode()).hexdigest()
            if user.password_hash != password_hash:
                return jsonify({'error': '비밀번호가 일치하지 않습니다.'}), 401

            if not user.is_approved:
                return jsonify({'error': '관리자 승인 대기 중입니다.'}), 403

            access_token = create_access_token(identity=user.user_uuid, expires_delta=timedelta(hours=1))
            return jsonify({'message': '로그인 성공','token': access_token,'is_admin': user.is_admin}), 200

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/messages/<other_uuid>', methods=['GET'])
    @jwt_required()
    def get_messages(other_uuid):
        current_uuid = get_jwt_identity()
        messages = Message.query.filter(
            ((Message.sender_uuid == current_uuid) & (Message.receiver_uuid == other_uuid)) |
            ((Message.sender_uuid == other_uuid) & (Message.receiver_uuid == current_uuid))
        ).order_by(Message.timestamp.asc()).all()

        return jsonify([
            {
                'sender': m.sender_uuid,             # ✅ sender_uuid로 명확히 반환
                'receiver': m.receiver_uuid,
                'sender_uuid': m.sender_uuid,        # ✅ 명시적으로 포함
                'receiver_uuid': m.receiver_uuid,    # ✅ 명시적으로 포함
                'text': m.message_text,
                'timestamp': m.timestamp.isoformat(),
                'file_name': m.file_name,           # 파일명 추가
                'file_type': m.file_type,           # 파일 타입 추가
                'message_id': m.id                  # 메시지 ID 추가 (다운로드용)
            } for m in messages
        ])

    @app.route('/api/messages', methods=['POST'])
    @jwt_required()
    def send_message():
        from app import socketio  # socketio 인스턴스 가져오기
        
        data = request.get_json()
        current_uuid = get_jwt_identity()

        sender = User.query.filter_by(user_uuid=current_uuid).first()
        if not sender:
            return jsonify({'error': '보내는 사용자를 찾을 수 없습니다.'}), 400

        # 👉 그룹 채팅 여부 판별
        if 'room_uuid' in data:
            msg = Message(
                sender_id=sender.id,
                sender_uuid=sender.user_uuid,
                message_text=data['text'],
                timestamp=datetime.utcnow(),
                room_uuid=data['room_uuid']
            )
            db.session.add(msg)
            db.session.commit()
            
            # Socket.IO로 그룹 채팅 메시지 알림 전송
            print(f"📨 그룹 채팅 메시지 전송: room_uuid={data['room_uuid']}, sender={sender.user_uuid}")
            
            # 그룹 멤버들에게 실시간 알림 전송
            members = ChatRoomMember.query.filter_by(room_uuid=data['room_uuid']).all()
            for member in members:
                socketio.emit('new_message', {
                    'sender_uuid': sender.user_uuid,
                    'room_uuid': data['room_uuid'],
                    'message': data['text']
                })
                socketio.emit('group_message', {
                    'room_uuid': data['room_uuid'],
                    'sender_uuid': sender.user_uuid,
                    'message': data['text']
                })
            
        elif 'receiver_uuid' in data:
            receiver = User.query.filter_by(user_uuid=data['receiver_uuid']).first()
            if not receiver:
                return jsonify({'error': '받는 사람을 찾을 수 없습니다.'}), 400

            msg = Message(
                sender_id=sender.id,
                receiver_id=receiver.id,
                sender_uuid=sender.user_uuid,
                receiver_uuid=receiver.user_uuid,
                message_text=data['text'],
                timestamp=datetime.utcnow()
            )
            db.session.add(msg)
            db.session.commit()
            
            # Socket.IO로 1:1 채팅 메시지 알림 전송
            socketio.emit('new_message', {
                'sender_uuid': sender.user_uuid,
                'receiver_uuid': receiver.user_uuid,
                'message': data['text']
            })
            
        else:
            return jsonify({'error': 'room_uuid 또는 receiver_uuid가 필요합니다.'}), 400
        
        return jsonify({
            'message': '전송 완료',
            'message_id': msg.id,
            'timestamp': msg.timestamp.isoformat()
        }), 201

    @app.route('/api/chat-rooms', methods=['GET'])
    @jwt_required()
    def get_chat_rooms():
        current_uuid = get_jwt_identity()

        # 🔹 1. 그룹 채팅방 목록 가져오기 - DISTINCT로 중복 제거
        group_rooms = (
            db.session.query(ChatRoom)
            .join(ChatRoomMember, ChatRoom.room_uuid == ChatRoomMember.room_uuid)
            .filter(ChatRoomMember.user_uuid == current_uuid, ChatRoom.is_group == True)
            .distinct(ChatRoom.room_uuid)  # 중복 제거
            .all()
        )

        group_room_data = []
        seen_room_uuids = set()  # 처리된 room_uuid 추적
        
        for room in group_rooms:
            # 이미 처리된 room_uuid는 스킵
            if room.room_uuid in seen_room_uuids:
                print(f"⚠️ [스킵] 이미 처리된 room: {room.room_uuid}")
                continue
            
            seen_room_uuids.add(room.room_uuid)
            print(f"🔍 [그룹 채팅방] room_uuid: {room.room_uuid}, name: {room.name}")
            
            last_msg = (
                db.session.query(Message)
                .filter(Message.room_uuid == room.room_uuid)
                .order_by(Message.timestamp.desc())
                .first()
            )
            
            print(f"📝 [마지막 메시지] room_uuid: {room.room_uuid}, last_msg: {last_msg.message_text if last_msg else 'None'}")

            # 메시지가 없는 그룹 채팅방은 제외
            if not last_msg:
                print(f"❌ [제외] {room.room_uuid}: 메시지가 없음")
                continue

            # 🔹 현재 사용자의 안 읽은 메시지 수 계산
            # 현재 사용자가 마지막으로 읽은 메시지 찾기
            last_read = (
                db.session.query(GroupChatReadStatus)
                .filter(GroupChatReadStatus.user_uuid == current_uuid, GroupChatReadStatus.room_uuid == room.room_uuid)
                .first()
            )
            
            print(f"🔍 [읽음 기록] room: {room.room_uuid}, user: {current_uuid}, last_read: {last_read}")
            
            if last_read:
                print(f"📅 [마지막 읽음 시간] {last_read.last_read_at}")
                # 마지막으로 읽은 메시지 이후의 메시지 수
                unread_messages = (
                    db.session.query(Message)
                    .filter(
                        Message.room_uuid == room.room_uuid,
                        Message.timestamp > last_read.last_read_at,
                        Message.sender_uuid != current_uuid  # 본인이 보낸 메시지 제외
                    )
                    .all()
                )
                unread_count = len(unread_messages)
                print(f"📊 [안 읽은 메시지들] {unread_count}개:")
                for msg in unread_messages:
                    print(f"   - {msg.timestamp}: {msg.message_text} (from: {msg.sender_uuid})")
            else:
                print(f"❌ [읽음 기록 없음] 모든 메시지를 안 읽음으로 계산 (본인 메시지 제외)")
                # 한 번도 읽지 않은 경우 - 모든 메시지 (본인 메시지 제외)
                unread_messages = (
                    db.session.query(Message)
                    .filter(
                        Message.room_uuid == room.room_uuid,
                        Message.sender_uuid != current_uuid  # 본인이 보낸 메시지 제외
                    )
                    .all()
                )
                unread_count = len(unread_messages)
                print(f"📊 [전체 안 읽은 메시지들] {unread_count}개:")
                for msg in unread_messages:
                    print(f"   - {msg.timestamp}: {msg.message_text} (from: {msg.sender_uuid})")

            members = (
                db.session.query(User)
                .join(ChatRoomMember, User.user_uuid == ChatRoomMember.user_uuid)
                .filter(ChatRoomMember.room_uuid == room.room_uuid)
                .all()
            )

            # 그룹 채팅방 이름 설정 - 실제 room.name이 있으면 사용, 없으면 멤버 이름 조합
            group_name = room.name if room.name and room.name.strip() else ', '.join([m.name for m in members if m.user_uuid != current_uuid])
            
            print(f"✅ [추가] 그룹방: {group_name}, 마지막 메시지: {last_msg.message_text}, 안 읽음: {unread_count}개")
            
            group_room_data.append({
                "uuid": room.room_uuid,
                "name": group_name,
                "department": '그룹채팅',
                "last_message": last_msg.message_text,
                "timestamp": last_msg.timestamp.isoformat(),
                "is_group": True,
                "unread_count": unread_count  # 실제 안 읽음 메시지 수 추가
            })

        # 🔹 2. 기존 1:1 채팅방 로직 유지
        subquery = (
            db.session.query(
                func.max(Message.timestamp).label("latest"),
                func.least(Message.sender_uuid, Message.receiver_uuid).label("user1"),
                func.greatest(Message.sender_uuid, Message.receiver_uuid).label("user2")
            )
            .filter(or_(
                Message.sender_uuid == current_uuid,
                Message.receiver_uuid == current_uuid
            ))
            .filter(Message.room_uuid == None)  # 그룹 채팅 메시지 제외
            .group_by("user1", "user2")
            .subquery()
        )

        results = (
            db.session.query(Message, User)
            .join(subquery, Message.timestamp == subquery.c.latest)
            .join(User, or_(
                User.user_uuid == Message.sender_uuid,
                User.user_uuid == Message.receiver_uuid
            ))
            .filter(User.user_uuid != current_uuid)
            .order_by(desc(Message.timestamp))
            .all()
        )

        one_on_one_rooms = []
        seen_users = set()  # 중복 방지
        for msg, user in results:
            # 빈 메시지는 제외
            if not msg.message_text or msg.message_text.strip() == "":
                continue
                
            if user.user_uuid not in seen_users:
                one_on_one_rooms.append({
                    'uuid': user.user_uuid,
                    'name': user.name,
                    'department': user.department,
                    'last_message': msg.message_text,
                    'timestamp': msg.timestamp.isoformat(),
                    "is_group": False
                })
                seen_users.add(user.user_uuid)

        # 전체 목록을 최신 메시지 순으로 정렬
        all_rooms = group_room_data + one_on_one_rooms
        all_rooms.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        print(f"📊 [최종 결과] 그룹방: {len(group_room_data)}개, 1:1방: {len(one_on_one_rooms)}개")
        
        return jsonify(all_rooms), 200
    
    @app.route('/api/delete-chat-room/<room_id>', methods=['DELETE'])
    @jwt_required()
    def delete_chat_room(room_id):
        try:
            current_uuid = get_jwt_identity()
            print(f"\n📌 [삭제 요청] room_id={room_id}, current_user={current_uuid}")

            # 🔍 그룹 채팅방 존재 확인
            room = ChatRoom.query.filter_by(room_uuid=room_id).first()
            print("🔍 ChatRoom 객체:", room)

            if room:
                # 🔐 현재 유저가 이 방의 멤버인지 확인
                member = ChatRoomMember.query.filter_by(room_uuid=room.room_uuid, user_uuid=current_uuid).first()
                if not member:
                    print("⛔️ 이 방의 멤버가 아닙니다.")
                    return jsonify({'error': '이 방의 멤버가 아닙니다.'}), 403

                # ✅ 채팅 메시지 불러오기
                messages = Message.query.filter_by(room_uuid=room.room_uuid).order_by(Message.timestamp).all()
                print(f"💬 메시지 {len(messages)}개 발견")

                # ✅ 로그 파일 저장 (없어도 생성)
                os.makedirs('chat_logs', exist_ok=True)
                filename = f"group_{room.room_uuid}_chat.txt"
                save_path = os.path.join('chat_logs', filename)

                with open(save_path, 'w', encoding='utf-8') as f:
                    for msg in messages:
                        f.write(f"[{msg.timestamp}] {msg.sender_uuid}: {msg.message_text}\n")
                print(f"📝 로그 저장 완료 → {save_path}")

                # ✅ 메시지, 멤버, 방 삭제
                Message.query.filter_by(room_uuid=room.room_uuid).delete()
                ChatRoomMember.query.filter_by(room_uuid=room.room_uuid).delete()
                GroupChatReadStatus.query.filter_by(room_uuid=room.room_uuid).delete()  # 읽음 상태도 삭제
                db.session.delete(room)
                db.session.commit()
                print("✅ 삭제 성공 및 DB 반영 완료")

                return jsonify({'message': '그룹 채팅방 삭제 완료'}), 200

            # 🔍 그룹 채팅방이 아니면 1:1 채팅 삭제 처리
            print("🔁 그룹방 없음 → 1:1 채팅 삭제 시도")
            messages = Message.query.filter(
                ((Message.sender_uuid == current_uuid) & (Message.receiver_uuid == room_id)) |
                ((Message.sender_uuid == room_id) & (Message.receiver_uuid == current_uuid))
            ).filter(Message.room_uuid == None).order_by(Message.timestamp.asc()).all()

            sender = User.query.filter_by(user_uuid=current_uuid).first()
            receiver = User.query.filter_by(user_uuid=room_id).first()

            os.makedirs('chat_logs', exist_ok=True)
            filename = f"{sender.name if sender else current_uuid}-{receiver.name if receiver else room_id}_chat.txt"
            save_path = os.path.join('chat_logs', filename)

            with open(save_path, 'w', encoding='utf-8') as f:
                for msg in messages:
                    sender_name = (
                        sender.name if sender and msg.sender_uuid == sender.user_uuid
                        else receiver.name if receiver else msg.sender_uuid
                    )
                    f.write(f"[{msg.timestamp}] {sender_name}: {msg.message_text}\n")
            print(f"📝 1:1 로그 저장 완료 → {save_path}")

            for msg in messages:
                db.session.delete(msg)
            db.session.commit()
            print("✅ 1:1 채팅 삭제 완료")

            return jsonify({'message': '1:1 채팅방 삭제 완료'}), 200

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'서버 오류: {str(e)}'}), 500
    
    @app.route('/api/delete-message/<int:message_id>', methods=['DELETE', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['DELETE', 'OPTIONS'])
    @jwt_required()
    def delete_message(message_id):
        try:
            current_uuid = get_jwt_identity()
            current_user = User.query.filter_by(user_uuid=current_uuid).first()
            
            if not current_user:
                return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 401
            
            # 메시지 조회
            message = Message.query.get(message_id)
            if not message:
                return jsonify({'error': '메시지를 찾을 수 없습니다.'}), 404
            
            # 권한 확인 - 본인이 보낸 메시지만 삭제 가능
            if message.sender_uuid != current_uuid:
                return jsonify({'error': '본인이 보낸 메시지만 삭제할 수 있습니다.'}), 403
            
            # 파일이 있는 메시지인 경우 파일도 삭제
            if message.file_path and os.path.exists(message.file_path):
                try:
                    os.remove(message.file_path)
                    print(f"🗑️ 파일 삭제 완료: {message.file_path}")
                except Exception as file_error:
                    print(f"⚠️ 파일 삭제 실패: {str(file_error)}")
                    # 파일 삭제 실패해도 메시지는 삭제 진행
            
            # 메시지 삭제
            db.session.delete(message)
            db.session.commit()
            
            print(f"✅ 메시지 삭제 완료: ID {message_id}")
            return jsonify({'message': '메시지가 삭제되었습니다.'}), 200
            
        except Exception as e:
            print(f"❌ 메시지 삭제 에러: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': '메시지 삭제 중 오류가 발생했습니다.'}), 500

    @app.route('/api/pending-users', methods=['GET'])
    @jwt_required()
    def get_pending_users():
        try:
            current_user_uuid = get_jwt_identity()
            print("🧪 current_user_uuid:", current_user_uuid)

            current_user = User.query.filter_by(user_uuid=current_user_uuid).first()
            if not current_user:
                print("❌ 현재 사용자 정보 없음")
                return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

            if not current_user.is_admin:
                print("❌ 관리자 아님")
                return jsonify({'error': '관리자만 접근 가능'}), 403

            users = User.query.filter_by(is_approved=False, is_rejected=False).all()
            print(f"🔎 대기 유저 {len(users)}명")
            return jsonify([{
                'id': u.id,
                'name': u.name,
                'username': u.username,
                'email': u.email,
            } for u in users])
        
        except Exception as e:
            print("❌ 예외 발생:", str(e))
            return jsonify({'error': '서버 오류'}), 500

    @app.route('/api/approve-user/<int:user_id>', methods=['PUT'])
    @jwt_required()
    def approve_user(user_id):
        current_user = User.query.filter_by(user_uuid=get_jwt_identity()).first()
        if not current_user or not current_user.is_admin:
            return jsonify({'error': '관리자만 승인할 수 있습니다.'}), 403

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

        user.is_approved = True
        db.session.commit()

        return jsonify({'message': '사용자 승인 완료'}), 200

    @app.route('/api/reject-user/<int:user_id>', methods=['PUT'])
    @jwt_required()
    def reject_user(user_id):
        current_user = User.query.filter_by(user_uuid=get_jwt_identity()).first()
        if not current_user or not current_user.is_admin:
            return jsonify({'error': '관리자만 반려할 수 있습니다.'}), 403

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

        user.is_rejected = True
        db.session.commit()

        return jsonify({'message': '사용자 반려 완료'}), 200
    
    @app.route('/api/create-chat-room', methods=['POST'])
    @jwt_required()
    def create_chat_room():
        data = request.get_json()
        member_uuids = data.get('members')
        room_name = data.get('name', '')

        if not member_uuids or len(member_uuids) < 2:
            return jsonify({'error': '2명 이상 선택해야 합니다.'}), 400

        room_uuid = str(uuid.uuid4())
        room = ChatRoom(room_uuid=room_uuid, is_group=True, name=room_name)
        db.session.add(room)

        for uuid_ in member_uuids:
            db.session.add(ChatRoomMember(room_uuid=room_uuid, user_uuid=uuid_))

        db.session.commit()
        return jsonify({'room_uuid': room_uuid}), 201
    
    @app.route('/api/chat-rooms/<room_uuid>', methods=['GET'])
    @jwt_required()
    def get_group_chat(room_uuid):
        current_uuid = get_jwt_identity()
        
        messages = Message.query.filter_by(room_uuid=room_uuid).order_by(Message.timestamp).all()
        members = (
            db.session.query(User.name, User.user_uuid)
            .join(ChatRoomMember, ChatRoomMember.user_uuid == User.user_uuid)
            .filter(ChatRoomMember.room_uuid == room_uuid)
            .all()
        )
        
        # 그룹 채팅방 입장 시 자동으로 읽음 표시
        now = datetime.utcnow()
        existing_read = GroupChatReadStatus.query.filter_by(
            user_uuid=current_uuid,
            room_uuid=room_uuid
        ).first()
        
        if existing_read:
            existing_read.last_read_at = now
        else:
            new_read = GroupChatReadStatus(
                user_uuid=current_uuid,
                room_uuid=room_uuid,
                last_read_at=now
            )
            db.session.add(new_read)
        
        db.session.commit()
        print(f"✅ 그룹 채팅방 입장 시 읽음 표시: user={current_uuid}, room={room_uuid}")

        return jsonify({
            'members': [{'name': m.name, 'uuid': m.user_uuid} for m in members],
            'messages': [
                {
                    'sender_uuid': msg.sender_uuid,
                    'text': msg.message_text,
                    'timestamp': msg.timestamp.isoformat(),
                    'file_name': msg.file_name,        # 파일명 추가
                    'file_type': msg.file_type,        # 파일 타입 추가
                    'message_id': msg.id               # 메시지 ID 추가 (다운로드용)
                } for msg in messages
            ]
        })

    @app.route('/api/chat-rooms/<room_uuid>/mark-read', methods=['POST'])
    @jwt_required()
    def mark_group_messages_read(room_uuid):
        try:
            current_uuid = get_jwt_identity()
            
            # 현재 사용자가 이 그룹 채팅방의 멤버인지 확인
            member = ChatRoomMember.query.filter_by(
                room_uuid=room_uuid,
                user_uuid=current_uuid
            ).first()
            
            if not member:
                return jsonify({'error': '이 채팅방의 멤버가 아닙니다.'}), 403
            
            # 현재 시간을 읽은 시간으로 기록
            now = datetime.utcnow()
            
            # 기존 읽음 기록이 있는지 확인
            existing_read = GroupChatReadStatus.query.filter_by(
                user_uuid=current_uuid,
                room_uuid=room_uuid
            ).first()
            
            if existing_read:
                # 기존 기록 업데이트
                existing_read.last_read_at = now
            else:
                # 새 읽음 기록 생성
                new_read = GroupChatReadStatus(
                    user_uuid=current_uuid,
                    room_uuid=room_uuid,
                    last_read_at=now
                )
                db.session.add(new_read)
            
            db.session.commit()
            
            print(f"✅ 그룹 채팅방 읽음 표시: user={current_uuid}, room={room_uuid}, time={now}")
            
            return jsonify({'message': '읽음 표시 완료'}), 200
            
        except Exception as e:
            print(f"❌ 읽음 표시 에러: {str(e)}")
            return jsonify({'error': '읽음 표시 중 오류가 발생했습니다.'}), 500

    @app.route('/api/upload-file', methods=['POST'])
    @jwt_required()
    def upload_file():
        try:
            current_uuid = get_jwt_identity()
            current_user = User.query.filter_by(user_uuid=current_uuid).first()
            
            if not current_user:
                return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 401
            
            if 'file' not in request.files:
                return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
            
            # 채팅방 정보 가져오기
            target_uuid = request.form.get('target_uuid')
            room_uuid = request.form.get('room_uuid')
            
            print(f"📤 파일 업로드 시작: {file.filename}, 크기: {file.content_length} bytes")
            
            # 파일 크기 제한 (10MB)
            file.seek(0, 2)  # 파일 끝으로 이동
            file_size = file.tell()
            file.seek(0)  # 파일 시작으로 되돌림
            
            if file_size > 10 * 1024 * 1024:
                return jsonify({'error': '파일 크기는 10MB를 초과할 수 없습니다.'}), 400
            
            # 허용된 파일 확장자
            allowed_extensions = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'}
            file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
            
            if file_extension not in allowed_extensions:
                return jsonify({'error': f'허용되지 않는 파일 형식입니다. 허용 형식: {", ".join(allowed_extensions)}'}), 400
            
            # 디렉토리 생성 (채팅방별)
            base_upload_dir = os.path.join(os.path.dirname(__file__), 'chat_files')
            
            if room_uuid:
                # 그룹 채팅방
                folder_name = f"group_{room_uuid}"
            else:
                # 1:1 채팅방
                other_user = User.query.filter_by(user_uuid=target_uuid).first()
                if not other_user:
                    return jsonify({'error': '상대방 사용자를 찾을 수 없습니다.'}), 400
                
                # 이름 순으로 정렬하여 일관된 폴더명 생성
                names = sorted([current_user.name, other_user.name])
                folder_name = f"{names[0]}_{names[1]}"
            
            upload_dir = os.path.join(base_upload_dir, folder_name)
            
            # 디렉토리 생성 확인
            try:
                os.makedirs(upload_dir, exist_ok=True)
                print(f"📁 업로드 디렉토리 생성/확인: {upload_dir}")
            except Exception as dir_error:
                print(f"❌ 디렉토리 생성 실패: {str(dir_error)}")
                return jsonify({'error': '파일 저장 디렉토리 생성에 실패했습니다.'}), 500
            
            # 파일명 생성: 날짜_보낸사람_원본파일명
            now = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_filename = secure_filename(file.filename)
            new_filename = f"{now}_{current_user.name}_{safe_filename}"
            
            # 파일 저장
            file_path = os.path.join(upload_dir, new_filename)
            
            try:
                file.save(file_path)
                print(f"💾 파일 저장 완료: {file_path}")
            except Exception as save_error:
                print(f"❌ 파일 저장 실패: {str(save_error)}")
                return jsonify({'error': '파일 저장에 실패했습니다.'}), 500
            
            # 메시지로 파일 정보 저장
            file_message = f"📎 파일: {file.filename}"
            
            try:
                if room_uuid:
                    # 그룹 채팅
                    msg = Message(
                        sender_id=current_user.id,
                        sender_uuid=current_user.user_uuid,
                        message_text=file_message,
                        timestamp=datetime.utcnow(),
                        room_uuid=room_uuid,
                        file_path=file_path,
                        file_name=file.filename,
                        file_type=file_extension
                    )
                else:
                    # 1:1 채팅
                    receiver = User.query.filter_by(user_uuid=target_uuid).first()
                    msg = Message(
                        sender_id=current_user.id,
                        receiver_id=receiver.id,
                        sender_uuid=current_user.user_uuid,
                        receiver_uuid=receiver.user_uuid,
                        message_text=file_message,
                        timestamp=datetime.utcnow(),
                        file_path=file_path,
                        file_name=file.filename,
                        file_type=file_extension
                    )
                
                db.session.add(msg)
                db.session.commit()
                print(f"✅ 파일 메시지 DB 저장 완료: ID {msg.id}")
                
                return jsonify({
                    'message': '파일 업로드 성공',
                    'file_name': file.filename,
                    'file_path': file_path,
                    'message_id': msg.id,
                    'file_size': file_size
                }), 200
                
            except Exception as db_error:
                print(f"❌ DB 저장 실패: {str(db_error)}")
                # 파일이 저장되었지만 DB 저장 실패 시 파일 삭제
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"🗑️ 실패한 파일 삭제: {file_path}")
                except:
                    pass
                return jsonify({'error': '파일 정보 저장에 실패했습니다.'}), 500
            
        except Exception as e:
            print(f"❌ 파일 업로드 전체 에러: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'파일 업로드 중 오류가 발생했습니다: {str(e)}'}), 500

    @app.route('/api/download-file/<int:message_id>', methods=['GET', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['GET', 'OPTIONS'])
    @jwt_required()
    def download_file(message_id):
        try:
            current_uuid = get_jwt_identity()
            msg = Message.query.get(message_id)
            
            if not msg or not msg.file_path:
                return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404
            
            # 권한 확인 (보낸 사람이거나 받은 사람이어야 함)
            if msg.room_uuid:
                # 그룹 채팅 - 해당 방의 멤버인지 확인
                member = ChatRoomMember.query.filter_by(
                    room_uuid=msg.room_uuid, 
                    user_uuid=current_uuid
                ).first()
                if not member:
                    return jsonify({'error': '파일 다운로드 권한이 없습니다.'}), 403
            else:
                # 1:1 채팅 - 보낸 사람이거나 받은 사람이어야 함
                if msg.sender_uuid != current_uuid and msg.receiver_uuid != current_uuid:
                    return jsonify({'error': '파일 다운로드 권한이 없습니다.'}), 403
            
            # 파일 존재 확인
            if not os.path.exists(msg.file_path):
                return jsonify({'error': '파일이 존재하지 않습니다.'}), 404
            
            # 이미지 파일인 경우 직접 반환 (브라우저에서 표시하기 위해)
            image_extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
            file_extension = msg.file_name.split('.')[-1].lower() if msg.file_name else ''
            
            if file_extension in image_extensions:
                # 이미지 파일은 인라인으로 표시
                return send_file(
                    msg.file_path,
                    as_attachment=False,
                    download_name=msg.file_name,
                    mimetype=f'image/{file_extension}'
                )
            else:
                # 일반 파일은 다운로드
                return send_file(
                    msg.file_path,
                    as_attachment=True,
                    download_name=msg.file_name
                )
            
        except Exception as e:
            print(f"파일 다운로드 에러: {str(e)}")
            return jsonify({'error': '파일 다운로드 중 오류가 발생했습니다.'}), 500

    @app.route('/api/password-reset/request', methods=['POST', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['POST', 'OPTIONS'])
    def request_password_reset():
        try:
            data = request.get_json()
            username = data.get('username')
            employee_id = data.get('employee_id')
            department = data.get('department')
            
            if not all([username, employee_id, department]):
                return jsonify({'error': '모든 필드를 입력해주세요.'}), 400
            
            # 사용자 정보 확인
            user = User.query.filter_by(
                username=username,
                employee_id=employee_id,
                department=department
            ).first()
            
            if not user:
                return jsonify({'error': '입력하신 정보와 일치하는 사용자를 찾을 수 없습니다.'}), 404
            
            # 기존 요청이 있는지 확인 (pending 상태)
            existing_request = PasswordResetRequest.query.filter_by(
                user_uuid=user.user_uuid,
                status='pending'
            ).first()
            
            if existing_request:
                return jsonify({
                    'message': '이미 비밀번호 재설정 요청이 진행 중입니다.',
                    'request_id': existing_request.id,
                    'status': existing_request.status,
                    'requested_at': existing_request.requested_at.isoformat()
                }), 200
            
            # 새로운 요청 생성
            new_request = PasswordResetRequest(
                username=username,
                employee_id=employee_id,
                department=department,
                user_uuid=user.user_uuid
            )
            
            db.session.add(new_request)
            db.session.commit()
            
            return jsonify({
                'message': '비밀번호 재설정 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.',
                'request_id': new_request.id
            }), 201
            
        except Exception as e:
            print(f"❌ 비밀번호 재설정 요청 에러: {str(e)}")
            return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

    @app.route('/api/password-reset/status', methods=['POST', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['POST', 'OPTIONS'])
    def check_password_reset_status():
        try:
            data = request.get_json()
            username = data.get('username')
            employee_id = data.get('employee_id')
            department = data.get('department')
            
            if not all([username, employee_id, department]):
                return jsonify({'error': '모든 필드를 입력해주세요.'}), 400
            
            # 사용자 정보 확인
            user = User.query.filter_by(
                username=username,
                employee_id=employee_id,
                department=department
            ).first()
            
            if not user:
                return jsonify({'error': '입력하신 정보와 일치하는 사용자를 찾을 수 없습니다.'}), 404
            
            # 최신 요청 찾기
            latest_request = PasswordResetRequest.query.filter_by(
                user_uuid=user.user_uuid
            ).order_by(PasswordResetRequest.requested_at.desc()).first()
            
            if not latest_request:
                return jsonify({'message': '비밀번호 재설정 요청 내역이 없습니다.'}), 404
            
            return jsonify({
                'request': latest_request.to_dict(),
                'user_name': user.name
            }), 200
            
        except Exception as e:
            print(f"❌ 비밀번호 재설정 상태 확인 에러: {str(e)}")
            return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

    @app.route('/api/password-reset/approve/<int:request_id>', methods=['PUT', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['PUT', 'OPTIONS'])
    @jwt_required()
    def approve_password_reset(request_id):
        try:
            current_uuid = get_jwt_identity()
            current_user = User.query.filter_by(user_uuid=current_uuid).first()
            
            if not current_user or not current_user.is_admin:
                return jsonify({'error': '관리자만 접근할 수 있습니다.'}), 403
            
            reset_request = PasswordResetRequest.query.get(request_id)
            if not reset_request:
                return jsonify({'error': '요청을 찾을 수 없습니다.'}), 404
            
            if reset_request.status != 'pending':
                return jsonify({'error': '이미 처리된 요청입니다.'}), 400
            
            # 요청 승인
            reset_request.status = 'approved'
            reset_request.processed_at = datetime.utcnow()
            reset_request.processed_by = current_uuid
            
            db.session.commit()
            
            return jsonify({'message': '비밀번호 재설정 요청이 승인되었습니다.'}), 200
            
        except Exception as e:
            print(f"❌ 비밀번호 재설정 승인 에러: {str(e)}")
            return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

    @app.route('/api/password-reset/reject/<int:request_id>', methods=['PUT', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['PUT', 'OPTIONS'])
    @jwt_required()
    def reject_password_reset(request_id):
        try:
            current_uuid = get_jwt_identity()
            current_user = User.query.filter_by(user_uuid=current_uuid).first()
            
            if not current_user or not current_user.is_admin:
                return jsonify({'error': '관리자만 접근할 수 있습니다.'}), 403
            
            reset_request = PasswordResetRequest.query.get(request_id)
            if not reset_request:
                return jsonify({'error': '요청을 찾을 수 없습니다.'}), 404
            
            if reset_request.status != 'pending':
                return jsonify({'error': '이미 처리된 요청입니다.'}), 400
            
            # 요청 거부
            reset_request.status = 'rejected'
            reset_request.processed_at = datetime.utcnow()
            reset_request.processed_by = current_uuid
            
            db.session.commit()
            
            return jsonify({'message': '비밀번호 재설정 요청이 거부되었습니다.'}), 200
            
        except Exception as e:
            print(f"❌ 비밀번호 재설정 거부 에러: {str(e)}")
            return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

    @app.route('/api/password-reset/reset', methods=['POST', 'OPTIONS'])
    @cross_origin(origins=base_url, methods=['POST', 'OPTIONS'])
    def reset_password():
        try:
            data = request.get_json()
            username = data.get('username')
            employee_id = data.get('employee_id')
            department = data.get('department')
            new_password = data.get('new_password')
            
            if not all([username, employee_id, department, new_password]):
                return jsonify({'error': '모든 필드를 입력해주세요.'}), 400
            
            # 사용자 정보 확인
            user = User.query.filter_by(
                username=username,
                employee_id=employee_id,
                department=department
            ).first()
            
            if not user:
                return jsonify({'error': '입력하신 정보와 일치하는 사용자를 찾을 수 없습니다.'}), 404
            
            # 승인된 요청이 있는지 확인
            approved_request = PasswordResetRequest.query.filter_by(
                user_uuid=user.user_uuid,
                status='approved'
            ).order_by(PasswordResetRequest.processed_at.desc()).first()
            
            if not approved_request:
                return jsonify({'error': '승인된 비밀번호 재설정 요청이 없습니다.'}), 403
            
            # 비밀번호 변경
            user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
            
            # 요청 상태를 완료로 변경
            approved_request.status = 'completed'
            
            db.session.commit()
            
            return jsonify({'message': '비밀번호가 성공적으로 변경되었습니다.'}), 200
            
        except Exception as e:
            print(f"❌ 비밀번호 재설정 에러: {str(e)}")
            return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

    @app.route('/api/admin/password-reset-requests', methods=['GET'])
    @jwt_required()
    def get_password_reset_requests():
        try:
            current_uuid = get_jwt_identity()
            current_user = User.query.filter_by(user_uuid=current_uuid).first()
            
            if not current_user or not current_user.is_admin:
                return jsonify({'error': '관리자만 접근할 수 있습니다.'}), 403
            
            # 대기 중인 요청들 가져오기
            pending_requests = PasswordResetRequest.query.filter_by(status='pending').order_by(PasswordResetRequest.requested_at.desc()).all()
            
            requests_data = []
            for req in pending_requests:
                user = User.query.filter_by(user_uuid=req.user_uuid).first()
                requests_data.append({
                    **req.to_dict(),
                    'user_name': user.name if user else 'Unknown'
                })
            
            return jsonify(requests_data), 200
            
        except Exception as e:
            print(f"❌ 비밀번호 재설정 요청 목록 조회 에러: {str(e)}")
            return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

