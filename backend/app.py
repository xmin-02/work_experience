from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO
import os
from dotenv import load_dotenv
from db import db
from sockets import register_socket_events
from routes import register_routes

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

socketio = SocketIO(cors_allowed_origins="*", async_mode='gevent')  # ✅ gevent 사용
jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    base_url = os.environ.get('REACT_APP_REA_BASE')
    if not base_url:
        raise ValueError("❌ REACT_APP_REA_BASE 환경 변수가 설정되지 않았습니다.")

    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://root:@localhost/hi_msg_db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY')

    db.init_app(app)
    jwt.init_app(app)
    Migrate(app, db)
    CORS(app, resources={r"/api/*": {"origins": base_url}}, supports_credentials=True)
    socketio.init_app(app)

    with app.app_context():
        from models import User, Message, MessageRead, ChatRoom, ChatRoomMember, PasswordResetRequest, GroupChatReadStatus
        db.create_all()

    register_routes(app)
    register_socket_events(socketio)

    return app


if __name__ == '__main__':
    app = create_app()
    print("✅ 서버 실행 시작")
    socketio.run(app, host='0.0.0.0', port=5050, debug=True)
# app.py 마지막 줄 근처에 추가
app = create_app()