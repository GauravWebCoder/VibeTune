import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import IntroAnimation from '../components/IntroAnimation';

export default function Home() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showIntro, setShowIntro] = useState(true);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = () => {
    if (!user && !username.trim()) return;
    if (!user) {
      login(username);
    }
    const newRoomCode = generateRoomCode();
    navigate(`/room/${newRoomCode}`);
  };

  const handleJoinRoom = () => {
    if (!user && !username.trim()) return;
    if (!roomCode.trim()) return;
    if (!user) {
      login(username);
    }
    navigate(`/room/${roomCode.toUpperCase()}`);
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  if (!user) {
    return (
      <>
        {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
        <div className="home-container">
        <div className="welcome-card">
          <div className="welcome-header">
            <div className="app-logo">
              <img src="/VibeTune WBG.png" alt="VibeTune Logo" className="logo-image" />
              <h1 className="app-title">VibeTune</h1>
            </div>
            <p>Create or join a room to listen to music with your friends in real-time!</p>
          </div>
          
          <div className="auth-section">
            <div className="input-group">
              <label>Enter your username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your cool username"
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
            </div>
          </div>

          <div className="room-actions">
            <div className="action-card">
              <h3><span className="emoji">🎉</span> Create New Room</h3>
              <p>Start a new listening party and share the room code with friends</p>
              <button 
                className="btn btn-primary btn-large"
                onClick={handleCreateRoom}
                disabled={!username.trim()}
              >
                Create Room
              </button>
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <div className="action-card">
              <h3><span className="emoji">🚪</span> Join Existing Room</h3>
              <p>Enter a room code to join your friends' listening party</p>
              <div className="join-form">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Room Code (e.g., ABC123)"
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
                <button 
                  className="btn btn-secondary btn-large"
                  onClick={handleJoinRoom}
                  disabled={!username.trim() || !roomCode.trim()}
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>

          <div className="features">
            <h3>✨ Features</h3>
            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-icon">🎵</span>
                <span>Upload MP3 files</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📺</span>
                <span>YouTube music search</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎧</span>
                <span>Spotify search</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💬</span>
                <span>Live chat</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⏭️</span>
                <span>Queue management</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔄</span>
                <span>Real-time sync</span>
              </div>
            </div>
          </div>
        </div>
        
        <footer className="home-footer">
          <p>© 2025 VibeTune. All rights reserved.</p>
          <p>Created By - Gaurav Mathpal</p>
        </footer>
        </div>
      </>
    );
  }

  return (
    <>
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
      <div className="home-container">
      <div className="welcome-card">
        <div className="welcome-header">
          <div className="app-logo">
            <img src="/VibeTune WBG.png" alt="VibeTune Logo" className="logo-image" />
            <h1 className="app-title">VibeTune</h1>
          </div>
          <p>Welcome back, {user.username}! Ready to create or join a listening party?</p>
        </div>
        
        <div className="room-actions">
          <div className="action-card">
            <h3><span className="emoji">🎉</span> Create New Room</h3>
            <p>Start a new listening party and share the room code with friends</p>
            <button 
              className="btn btn-primary btn-large"
              onClick={handleCreateRoom}
            >
              Create Room
            </button>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="action-card">
            <h3><span className="emoji">🚪</span> Join Existing Room</h3>
            <p>Enter a room code to join your friends' listening party</p>
            <div className="join-form">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Room Code (e.g., ABC123)"
                maxLength={6}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <button 
                className="btn btn-secondary btn-large"
                onClick={handleJoinRoom}
                disabled={!roomCode.trim()}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="home-footer">
        <p>© 2025 VibeTune. All rights reserved.</p>
        <p>Created By - Gaurav Mathpal</p>
      </footer>
      </div>
    </>
  );
}