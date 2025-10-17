// Server-based sync system using HTTP requests
class ServerSync {
  constructor() {
    this.roomId = null;
    this.pollInterval = null;
    this.listeners = new Map();
    this.lastUpdate = 0;
    this.serverUrl = 'https://vibetune-production.up.railway.app';
    this.isConnected = false;
    this.lastRequestTime = 0;
    this.requestCooldown = 50; // 0.05 seconds between requests for instant sync
  }

  async joinRoom(roomId) {
    // Joining room
    this.roomId = roomId;
    
    try {
      // Test connection to server
      const response = await fetch(`${this.serverUrl}/health`);
      if (response.ok) {
        this.isConnected = true;
        // Connected to server
        this.startPolling();
      } else {
        // Server not available, using fallback
        this.isConnected = false;
      }
    } catch (error) {
      // Server connection failed, using fallback
      this.isConnected = false;
    }
  }

  leaveRoom() {
    // Leaving room
    this.roomId = null;
    this.stopPolling();
  }

  startPolling() {
    if (this.pollInterval) return;
    
    // Starting polling
    this.pollInterval = setInterval(() => {
      this.checkForUpdates();
    }, 200); // Poll every 0.2 seconds for instant sync
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
          
          if (timestamp > this.lastUpdate) {
            // Only process updates if there's actual content or if it's the first update
            const hasContent = roomData.currentSong || roomData.queue?.length > 0 || roomData.users?.length > 0;
            const isFirstUpdate = this.lastUpdate === 0;
            
            if (hasContent || isFirstUpdate) {
              if (hasContent) {
                // Found server update
              }
              this.lastUpdate = timestamp;
              this.notifyListeners('roomUpdate', roomData);
            } else {
              // Skip empty room updates to prevent console spam
              this.lastUpdate = timestamp;
            }
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
          this.notifyListeners('roomUpdate', data);
        }
      }
    } catch (error) {
      // console.error('🔄 ServerSync: Error with localStorage fallback', error);
    }
  }

  async broadcastPlayPause(isPlaying, currentSong) {
    if (!this.roomId) return;
    
    // Broadcasting play/pause
    
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
            data: { isPlaying, currentSong }
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
      type: 'playPause'
    });
  }

  async broadcastSongChange(song) {
    if (!this.roomId) return;
    
    // Broadcasting song change
    
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
            data: { currentSong: song, isPlaying: true }
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
    
    // Don't broadcast seek updates for 0 position unless it's intentional
    if (currentTime === 0) {
      // Skipping seek broadcast for position 0
      return;
    }
    
    // Broadcasting seek
    
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
            data: { queue: queue }
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
      type: 'queueUpdate'
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
