import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RootPage from './pages/RootPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainPage from './pages/MainPage';
import MessagePage from './pages/MessagePage';
import AdminPage from './pages/AdminPage';
import Mypage from './pages/Mypage';
import PasswordResetPage from './pages/PasswordResetPage';
import PasswordChangePage from './pages/PasswordChangePage';
import CreateGroupPage from './pages/CreateGroupPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/message" element={<MessagePage />} />
          <Route path="/message/:uuid" element={<MessagePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/mypage" element={<Mypage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route path="/password-change" element={<PasswordChangePage />} />
          <Route path="/create-group" element={<CreateGroupPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;