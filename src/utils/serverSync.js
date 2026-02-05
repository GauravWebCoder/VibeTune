// Server-based sync system using HTTP requests
import { io } from 'socket.io-client';

class ServerSync {
  constructor() {
    this.roomId = null;
    this.pollInterval = null;
    this.listeners = new Map();
    this.lastUpdate = 0;
    // Prefer Vite env, fallback to Railway deployment
    this.serverUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_SERVER_URL)
      ? import.meta.env.VITE_SOCKET_SERVER_URL
      : 'https://vibetune-production.up.railway.app';
    this.isConnected = false;
    this.lastRequestTime = 0;
    this.requestCooldown = 100; // 0.1 seconds between requests for better responsiveness
    this.socket = null;
    this.user = null;
    this.lastDeliveredCurrentTime = null;
    this.lastIsPlaying = null;
    this.lastSongId = null;
    this.lastSocketTickAt = 0;
  }
  
  sanitizeSongData(song) {
    if (!song || typeof song !== 'object') return null;
    const {
      id,
      title,
      artist,
      thumbnail,
      duration,
      url,
      permanentUrl,
      ytId,
      provider,
      needsResolution
    } = song;
    const isYouTube = provider === 'youtube' || Boolean(ytId);
    const safeUrl = (!isYouTube && typeof url === 'string' && /^https?:\/\//.test(url)) ? url : undefined;
    return {
      id,
      title,
      artist,
      thumbnail: thumbnail || '/music img.png',
      duration,
      permanentUrl,
      url: safeUrl,
      ytId,
      provider,
      needsResolution: Boolean(needsResolution || (isYouTube && !safeUrl))
    };
  }

  sanitizeQueue(queue) {
    if (!Array.isArray(queue)) return [];
    return queue.map(s => this.sanitizeSongData(s)).filter(Boolean);
  }

  async joinRoom(roomId, user) {
    // Joining room
    this.roomId = roomId;
    this.user = user || this.user;
    this.lastDeliveredCurrentTime = null;
    this.lastIsPlaying = null;
    this.lastSongId = null;
    
    await this.ensureSocket();
    // Always keep lightweight polling active for tick currentTime, even with socket
    this.startPolling();
  }

  leaveRoom() {
    // Leaving room
    this.roomId = null;
    this.stopPolling();
    if (this.socket) {
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }
  }

  async ensureSocket() {
    if (this.socket && this.socket.connected) return;
    try {
      // Test connection via HTTP first
      const response = await fetch(`${this.serverUrl}/health`);
      this.isConnected = response.ok;
    } catch (_) {
      this.isConnected = false;
    }

    try {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        // prefer socket, stop polling
        this.stopPolling();
        // Join room with minimal user info
        if (this.roomId) {
          const safeUser = this.user || {};
          this.socket.emit('join_room', {
            roomId: this.roomId,
            user: {
              id: safeUser.id || 'anon',
              username: safeUser.username || 'Anonymous',
              avatar: safeUser.avatar || '/music img.png'
            }
          });
        }
      });

      this.socket.on('room_state', (state) => {
        // Normalize and notify
        const data = {
          ...state,
          queue: this.sanitizeQueue(state?.queue || []),
          currentSong: this.sanitizeSongData(state?.currentSong),
          type: 'room_state'
        };
        if (typeof state?.shuffleMode === 'boolean') {
          data.shuffleMode = state.shuffleMode;
        }
        this.notifyListeners('roomUpdate', data);
      });

      this.socket.on('sync_event', (evt) => {
        const { type, payload, fromUserId } = evt || {};
        if (!type) return;
        this.lastSocketTickAt = Date.now();
        const normalized = {
          type,
          isPlaying: type === 'play' ? true : type === 'pause' ? false : undefined,
          currentTime: payload?.currentTime ?? payload?.currentPosition,
          duration: payload?.duration,
          timestamp: Date.now(),
          fromUserId
        };
        if (typeof payload?.shuffleMode === 'boolean') {
          normalized.shuffleMode = payload.shuffleMode;
        }
        if (payload?.currentSong) {
          normalized.currentSong = this.sanitizeSongData(payload.currentSong);
        }
        if (Array.isArray(payload?.queue)) {
          normalized.queue = this.sanitizeQueue(payload.queue);
          if (payload?.forceQueueClear) {
            normalized.forceQueueClear = true;
          }
        }
        this.notifyListeners('roomUpdate', normalized);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        // restart fallback polling
        this.startPolling();
      });
    } catch (_) {
      // ignore socket errors; fallback to HTTP
    }
  }

  startPolling() {
    if (this.pollInterval) return;
    
    // Starting polling
    this.pollInterval = setInterval(() => {
      this.checkForUpdates();
    }, 500); // Poll every 0.5 seconds for better responsiveness
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      // Stopped polling
    }
  }

  async checkForUpdates() {
    if (!this.roomId) return;
    // Avoid duplicate ticks within 600ms after a socket event
    if (this.socket && this.socket.connected) {
      const sinceSocket = Date.now() - (this.lastSocketTickAt || 0);
      if (sinceSocket < 600) return;
    }

    // Rate limiting to prevent too many requests
    const now = Date.now();
    if (now - this.lastRequestTime < this.requestCooldown) {
      return;
    }
    this.lastRequestTime = now;

    if (this.isConnected) {
      try {
        const response = await fetch(`${this.serverUrl}/room/${this.roomId}`);
        if (response.ok) {
          const roomData = await response.json();
          const timestamp = Date.now();
          const isFirstUpdate = this.lastUpdate === 0;
          const currentTimeVal = Number(roomData.currentTime) || 0;
          const songId = roomData.currentSong && roomData.currentSong.id ? String(roomData.currentSong.id) : null;
          const playingChanged = this.lastIsPlaying !== null && this.lastIsPlaying !== !!roomData.isPlaying;
          const songChanged = this.lastSongId !== null && this.lastSongId !== songId;
          const timeChanged = this.lastDeliveredCurrentTime === null || Math.abs(currentTimeVal - this.lastDeliveredCurrentTime) >= 0.25;

          if (timestamp > this.lastUpdate && (isFirstUpdate || playingChanged || songChanged || timeChanged)) {
            this.lastUpdate = timestamp;
            this.lastDeliveredCurrentTime = currentTimeVal;
            this.lastIsPlaying = !!roomData.isPlaying;
            this.lastSongId = songId;
            this.notifyListeners('roomUpdate', { ...roomData, type: 'tick' });
          }
        } else if (response.status === 404) {
          // Room not found, creating room
          // Room doesn't exist yet, that's okay - just skip this update
          return;
        } else {
          // console.error('🔄 ServerSync: Server error:', response.status);
          this.isConnected = false;
          this.fallbackToLocalStorage();
        }
      } catch (error) {
        // console.error('🔄 ServerSync: Error checking server updates', error);
        // If server becomes unavailable, fall back to localStorage
        this.isConnected = false;
        this.fallbackToLocalStorage();
      }
    } else {
      // Use localStorage fallback
      this.fallbackToLocalStorage();
    }
  }

  fallbackToLocalStorage() {
    // Falling back to localStorage
    if (!this.roomId) return;

    try {
      const roomData = localStorage.getItem(`room_${this.roomId}`);
      if (roomData) {
        const data = JSON.parse(roomData);
        if (data.timestamp > this.lastUpdate) {
          // Found localStorage update
          this.lastUpdate = data.timestamp;
          this.notifyListeners('roomUpdate', { ...data, type: data.type || 'tick' });
        }
      }
    } catch (error) {
      // console.error('🔄 ServerSync: Error with localStorage fallback', error);
    }
  }

  async broadcastPlayPause(isPlaying, currentSong, currentTime) {
    if (!this.roomId) return;
    
    // Broadcasting play/pause
    
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('sync_event', {
          roomId: this.roomId,
          type: isPlaying ? 'play' : 'pause',
          payload: { 
            currentSong: this.sanitizeSongData(currentSong) || null,
            currentTime
          }
        });
        return;
      } catch (_) {}
    }

    if (this.isConnected) {
      // Try to use server first
      try {
        const response = await fetch(`${this.serverUrl}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'playPause',
            data: { isPlaying, currentSong: this.sanitizeSongData(currentSong) || null, currentTime }
          })
        });
        
        if (response.ok) {
          // Server sync successful
          return;
        }
      } catch (error) {
        // Server sync failed, using localStorage
      }
    }
    
    // Fallback to localStorage
    this.updateLocalStorage({
      isPlaying,
      currentSong,
      currentTime,
      type: 'playPause'
    });
  }

  async broadcastSongChange(song) {
    if (!this.roomId) return;
    
    // Broadcasting song change
    
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('sync_event', {
          roomId: this.roomId,
          type: 'song_change',
          payload: { currentSong: this.sanitizeSongData(song) }
        });
        return;
      } catch (_) {}
    }

    if (this.isConnected) {
      try {
        const response = await fetch(`${this.serverUrl}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'songChange',
            data: { currentSong: this.sanitizeSongData(song), isPlaying: true }
          })
        });
        
        if (response.ok) {
          // Server sync successful
          return;
        }
      } catch (error) {
        // Server sync failed, using localStorage
      }
    }
    
    // Fallback to localStorage
    this.updateLocalStorage({
      currentSong: song,
      isPlaying: true,
      type: 'songChange'
    });
  }

  async broadcastSeek(currentTime) {
    if (!this.roomId) return;
    
    // Broadcasting seek
    
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('sync_event', {
          roomId: this.roomId,
          type: 'seek',
          payload: { currentTime }
        });
        return;
      } catch (_) {}
    }

    if (this.isConnected) {
      try {
        const response = await fetch(`${this.serverUrl}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'seek',
            data: { currentPosition: currentTime }
          })
        });
        
        if (response.ok) {
          // Server sync successful
          return;
        }
      } catch (error) {
        // Server sync failed, using localStorage
      }
    }
    
    // Fallback to localStorage
    this.updateLocalStorage({
      currentPosition: currentTime,
      type: 'seek'
    });
  }

  async broadcastQueueUpdate(queue) {
    if (!this.roomId) return;
    
    // Broadcasting queue update
    
    const forceQueueClear = Array.isArray(queue) && queue.length === 0;
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('sync_event', {
          roomId: this.roomId,
          type: 'queue_update',
          payload: { queue: this.sanitizeQueue(queue), forceQueueClear }
        });
        return;
      } catch (_) {}
    }

    if (this.isConnected) {
      try {
        const response = await fetch(`${this.serverUrl}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'queueUpdate',
            data: { queue: this.sanitizeQueue(queue), forceQueueClear }
          })
        });
        
        if (response.ok) {
          // Queue update successful
          return;
        }
      } catch (error) {
        // Queue update failed, using localStorage
      }
    }
    
    // Fallback to localStorage
    this.updateLocalStorage({
      queue: queue,
      type: 'queueUpdate',
      forceQueueClear
    });
  }

  async broadcastShuffleMode(shuffleMode) {
    if (!this.roomId) return;
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('sync_event', {
          roomId: this.roomId,
          type: 'shuffle',
          payload: { shuffleMode: !!shuffleMode }
        });
        return;
      } catch (_) {}
    }
    this.updateLocalStorage({
      shuffleMode: !!shuffleMode,
      type: 'shuffle'
    });
  }

  updateLocalStorage(data) {
    if (!this.roomId) return;

    try {
      const roomData = {
        ...data,
        timestamp: Date.now(),
        roomId: this.roomId
      };
      
      localStorage.setItem(`room_${this.roomId}`, JSON.stringify(roomData));
      // Updated localStorage
    } catch (error) {
      // console.error('🔄 ServerSync: Error updating localStorage', error);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  notifyListeners(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // console.error('🔄 ServerSync: Error in listener', error);
        }
      });
    }
  }
}

// Create a global instance
const serverSync = new ServerSync();

export default serverSync;
