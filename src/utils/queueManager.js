// Global Queue Manager - handles communication between Search and Room components
class QueueManager {
  constructor() {
    this.listeners = new Set();
    this.queue = [];
    this.currentSong = null;
    this.isPlaying = false;
    this.isUpdating = false; // Flag to prevent infinite recursion
  }

  // Add a listener for queue changes
  addListener(callback) {
    this.listeners.add(callback);
    // QueueManager: Added listener
    
    // Immediately call the callback with current state
    callback({
      queue: this.queue,
      currentSong: this.currentSong,
      isPlaying: this.isPlaying
    });
    
    return () => {
      this.listeners.delete(callback);
      // QueueManager: Removed listener
    };
  }

  // Add items to queue
  addItems(items, skipSync = false) {
    if (this.isUpdating) {
      return;
    }
    this.isUpdating = true;
    this.queue = [...this.queue, ...items];
    this.notifyListeners(skipSync);
    this.isUpdating = false;
  }

  // Update entire queue
  updateQueue(newQueue, skipSync = false) {
    if (this.isUpdating) {
      return;
    }
    this.isUpdating = true;
    this.queue = newQueue;
    this.notifyListeners(skipSync);
    this.isUpdating = false;
  }

  // Clear queue and reset state
  clearQueue() {
    this.isUpdating = true;
    this.queue = [];
    this.currentSong = null;
    this.isPlaying = false;
    this.notifyListeners(true); // Skip sync when clearing
    this.isUpdating = false;
  }

  // Set current song
  setCurrentSong(song) {
    // QueueManager: Setting current song
    this.currentSong = song;
    this.notifyListeners();
  }

  // Set playing state
  setIsPlaying(playing) {
    // QueueManager: Setting playing state
    this.isPlaying = playing;
    this.notifyListeners();
  }

  // Get current state
  getState() {
    return {
      queue: this.queue,
      currentSong: this.currentSong,
      isPlaying: this.isPlaying
    };
  }

  // Notify all listeners
  notifyListeners(skipSync = false) {
    const state = this.getState();
    
    this.listeners.forEach(callback => {
      try {
        callback(state, skipSync);
      } catch (error) {
        // console.error('🎧 QueueManager: Error in listener callback:', error);
      }
    });
  }

  // Clear queue
  clearQueue() {
    // QueueManager: Clearing queue
    this.queue = [];
    this.currentSong = null;
    this.isPlaying = false;
    this.notifyListeners();
  }
}

// Create global instance
const queueManager = new QueueManager();

export default queueManager;
