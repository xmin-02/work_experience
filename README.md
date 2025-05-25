# 일경험 사업 레파지토리 입니다
### 내부망 기반의 사내 메신저 시스템 개발

# 할 일
1. 메신저 시스템 개발
2. 내부 망에서만 사용 가능하도록 보안 요소 설정

## 메신저 개발 - 카카오톡 기능을 모티브로 ㄱㄱ
기능
1. 로그인 - 회원 관리
2. 관리자 권한
3. 실시간 메신저 기능 - 중요
4. 채팅방 목록 기능
5. 사진 등 파일 전송 기능
6. 로그

## 전체적인 틀은 한 번에 개발, 다듬는 과정에서 역할 분담에서 할듯
사용 기술</br>
Node JS, Flask, My SQL, Ngrok</br>
</br>
사전 준비</br>
Vs code 설치</br>
Ngrok 회원 가입 및 설치 https://dashboard.ngrok.com/signup?ref=home-hero </br>
My SQL 설치 https://code-angie.tistory.com/158

# 예상 개발 계획
1. Node JS, Flask 활용하여 웹 사이트 개발 및 My SQL DB 연결 - 알려주면서 하면 약 3 ~ 4주 예상
2. 개발 중 큰 틀이 짜여지면, 각 인원은 기능 담당하여 다듬기 ㄱㄱ 
3. Ngrok로 외부 연결해서 모두 접속하면서 확인
4. 이후 회사의 상황에 따라 내부망만 접속 가능하게 설정 -> 이후론 외부에서 접속 불가

###########################################################

# 환경 설정 ( 툴 설치 등 )
### 맥
```
Homebrew : /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh
Node.js : brew install node
Python3 : brew install python@3.11
MySQL : brew install mysql
Git : brew install git
VSCode : https://code.visualstudio.com
Postman : https://www.postman.com/downloads/
```
### 윈도우
```
Node.js : https://nodejs.org/
Python 3.11 : https://www.python.org/downloads/windows/
MySQL : https://dev.mysql.com/downloads/installer/
Git : https://git-scm.com/download/win
VSCode : https://code.visualstudio.com/
Postman : https://www.postman.com/downloads/
WSL : Windows Terminal ->  wsl --install
```

######################################################
# 맥 개발 환경 설정
```
# macOS 전체 설치 요약
brew install node python@3.11 mysql git
brew services start mysql

# 프로젝트 디렉토리 생성
mkdir project-root && cd project-root
mkdir backend-flask socket-server mysql

# Flask 세팅
cd backend-flask
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors flask-sqlalchemy pymysql python-dotenv

# Node.js 세팅
cd ../socket-server
npm init -y
npm install express socket.io mysql dotenv
```


