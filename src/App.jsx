import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Room from "./pages/Room";
import Home from "./pages/Home";
import ErrorBoundary from "./components/ErrorBoundary";
import { PlaybackProvider } from './contexts/PlaybackContext';
import { AuthProvider } from './contexts/AuthContext';
import { SpotifyProvider } from './contexts/SpotifyContext';
import { useAuth } from './hooks/useAuth';
import { usePlayback } from './hooks/usePlayback';

function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { pause, setCurrentSong } = usePlayback();
  const currentRoomId = location.pathname.startsWith('/room/') ? location.pathname.split('/')[2] : null;
  
  // Close sidebar when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1200) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLeaveParty = () => {
    // Stop music and clear current song
    pause();
    setCurrentSong(null);
    // Navigate to home
    navigate('/');
  };

  return (
    <>
      {/* Hamburger Menu Button for Mobile/Tablet */}
      <button 
        className={`hamburger-menu ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <img src="/VibeTune WBG.png" alt="VibeTune" className="sidebar-logo" />
            <span className="brand-text">VibeTune</span>
          </div>
          <button 
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>
        <ul className="nav-list">
          <li><NavLink className="nav-link" to="/" onClick={() => setSidebarOpen(false)}>Home</NavLink></li>
          {currentRoomId && (
            <li><NavLink className="nav-link" to={`/room/${currentRoomId}`} onClick={() => setSidebarOpen(false)}>Room: {currentRoomId}</NavLink></li>
          )}
          {currentRoomId && (
            <li>
              <button className="nav-link leave-btn" onClick={() => { handleLeaveParty(); setSidebarOpen(false); }}>
                🚪 Leave Party
              </button>
            </li>
          )}
          {user && (
            <li>
              <button className="nav-link logout-btn" onClick={() => { logout(); setSidebarOpen(false); }}>
                🚪 Logout ({user.username})
              </button>
            </li>
          )}
        </ul>
        
        {/* Social Media Links */}
        <div className="sidebar-footer">
          <div className="social-links">
            <a 
              href="https://linkedin.com/in/gaurav-mathpal" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link linkedin"
              title="LinkedIn Profile"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span>LinkedIn</span>
            </a>
            <a 
              href="https://github.com/GauravWebCoder" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link github"
              title="GitHub Profile"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
          <div className="creator-info">
            <p>Created by <strong>Gaurav Mathpal</strong></p>
          </div>
        </div>
      </nav>
    </>
  );
}

function FooterPlayer() {
  const { currentSong, isPlaying, togglePlayPause, skipNext, skipPrevious, audioRef } = usePlayback();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);

  // Update progress bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    const updateDuration = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
    };
  }, [audioRef, currentSong]);

  // Simple sync - no complex event listeners needed

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Broadcast seek to room if available
    if (window.roomSync) {
      // Broadcasting seek from footer player
      window.roomSync.broadcastSeek(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audio.volume = newVolume;
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.volume > 0) {
      audio.volume = 0;
      setVolume(0);
    } else {
      audio.volume = 0.7;
      setVolume(0.7);
    }
  };

  
  return (
    <footer className="spotify-player-bar">
      <div className="spotify-player-content">
        {/* Left Section - Song Info */}
        <div className="spotify-song-info">
          {currentSong ? (
            <>
              <img 
                src={currentSong.thumbnail || currentSong.artwork || '/music img.png'} 
                alt={currentSong.title}
                className="spotify-artwork"
              />
              <div className="spotify-song-details">
                <h4 className="spotify-song-title">{currentSong.title}</h4>
                <p className="spotify-song-artist">{currentSong.artist}</p>
              </div>
            </>
          ) : (
            <div className="spotify-placeholder">
              <div>No song selected</div>
            </div>
          )}
        </div>
        
        {/* Center Section - Controls & Progress */}
        <div className="spotify-center-section">
          <div className="spotify-controls">
            
            <button className="spotify-control-btn spotify-prev-btn" onClick={() => {
              if (window.roomControls && window.roomControls.skipPrevious) {
                window.roomControls.skipPrevious();
              } else {
                skipPrevious();
              }
            }} title="Previous">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button 
              className="spotify-play-btn" 
              onClick={() => {
                const newPlayingState = !isPlaying;
                if (window.roomSync) {
                  window.roomSync.broadcastPlayPause(newPlayingState);
                }
                togglePlayPause();
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button className="spotify-control-btn spotify-next-btn" onClick={() => {
              // Footer skip next clicked
              if (window.roomControls && window.roomControls.skipNext) {
                window.roomControls.skipNext();
              } else {
                // Calling playback context skipNext
                skipNext();
              }
            }} title="Next">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
            
          </div>
          
          <div className="spotify-progress-section">
            <div className="spotify-progress-bar" onClick={handleProgressClick}>
              <div className="spotify-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
              <div className="spotify-progress-thumb" style={{ left: `${progressPercentage}%` }}></div>
            </div>
            <div className="spotify-time-display">
              <span className="spotify-current-time">{formatTime(currentTime)}</span>
              <span className="spotify-total-time">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        
        {/* Right Section - Volume */}
        <div className="spotify-volume-section">
          <button className="spotify-volume-btn" onClick={toggleMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
            {volume === 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : volume < 0.5 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
          <div className="spotify-volume-slider-container">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="spotify-volume-slider"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}

function AppLayout() {
  const location = useLocation();
  const currentRoomId = location.pathname.startsWith('/room/') ? location.pathname.split('/')[2] : 
                       location.pathname.startsWith('/search/') ? location.pathname.split('/')[2] : null;
  const isInRoom = location.pathname.startsWith('/room/');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={
            <ErrorBoundary>
              <Room />
            </ErrorBoundary>
          } />
        </Routes>
      </main>
      {isInRoom && <FooterPlayer />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SpotifyProvider>
          <PlaybackProvider>
            <AppLayout />
          </PlaybackProvider>
        </SpotifyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;