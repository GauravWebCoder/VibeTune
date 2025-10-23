const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS for all origins
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

// Parse JSON bodies
app.use(express.json());

// Create Socket.IO instance
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store room data
const rooms = new Map();

// Helper function to get or create room
function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      queue: [],
      currentSong: null,
      isPlaying: false,
      currentTime: 0, // base position (seconds)
      startedAt: null // server ms when play started (null if paused)
    });
  }
  return rooms.get(roomId);
}

// Helper function to broadcast to room
function broadcastToRoom(roomId, event, data, excludeSocket = null) {
  const room = getRoom(roomId);
  room.users.forEach((userData, socketId) => {
    if (socketId !== excludeSocket) {
      io.to(socketId).emit(event, data);
    }
  });
}

// Compute live position based on server clock
function getComputedCurrentTime(room) {
  if (room.isPlaying && typeof room.startedAt === 'number') {
    const elapsedMs = Date.now() - room.startedAt;
    return Math.max(0, room.currentTime + elapsedMs / 1000);
  }
  return Math.max(0, room.currentTime);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  // console.log('🔌 User connected:', socket.id);

  // Join room
  socket.on('join_room', (data) => {
    const { roomId, user } = data;
    // console.log('🏠 User joining room:', roomId, 'user:', user.username);
    
    socket.join(roomId);
    
    const room = getRoom(roomId);
    room.users.set(socket.id, {
      ...user,
      socketId: socket.id,
      joinedAt: new Date().toISOString()
    });

    // Send current room state to new user
    const roomState = {
      queue: room.queue,
      isPlaying: room.isPlaying,
      currentTime: getComputedCurrentTime(room),
      users: Array.from(room.users.values())
    };
    
    // Only include currentSong if it's valid and has required fields
    if (room.currentSong && room.currentSong.id && room.currentSong.title && Object.keys(room.currentSong).length > 2) {
      roomState.currentSong = room.currentSong;
    }
    
    socket.emit('room_state', roomState);

    // Notify other users about new user
    broadcastToRoom(roomId, 'user_joined', {
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        joinedAt: new Date().toISOString()
      }
    }, socket.id);

    // console.log('👥 Room users:', Array.from(room.users.values()).map(u => u.username));
  });

  // Handle sync events
  socket.on('sync_event', (data) => {
    const { roomId, type, payload } = data;
    // console.log('🔄 Sync event:', type, 'from:', socket.id);
    
    const room = getRoom(roomId);
    
    // Update room state based on event type
    switch (type) {
      case 'play':
        room.isPlaying = true;
        if (payload.currentSong) {
          room.currentSong = payload.currentSong;
        }
        // Start server clock from current base position
        room.startedAt = Date.now();
        break;
      case 'pause':
        // Freeze position based on elapsed time, then pause
        room.currentTime = getComputedCurrentTime(room);
        room.startedAt = null;
        room.isPlaying = false;
        break;
      case 'seek':
        if (payload.currentTime !== undefined) {
          room.currentTime = Math.max(0, Number(payload.currentTime) || 0);
          // Keep clock continuity if playing
          if (room.isPlaying) {
            room.startedAt = Date.now();
          }
        }
        break;
      case 'queue_update':
        if (payload.queue) {
          room.queue = payload.queue;
        }
        break;
      case 'song_change':
        if (payload.currentSong) {
          room.currentSong = payload.currentSong;
        }
        room.currentTime = 0;
        if (room.isPlaying) {
          room.startedAt = Date.now();
        }
        break;
    }

    // Broadcast to other users in room
    broadcastToRoom(roomId, 'sync_event', {
      type,
      payload: { ...payload, currentTime: payload?.currentTime ?? payload?.currentPosition },
      fromUserId: room.users.get(socket.id)?.id
    }, socket.id);

    // Also send a consolidated room_state snapshot back to the sender
    io.to(socket.id).emit('room_state', {
      queue: room.queue,
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      currentTime: getComputedCurrentTime(room),
      users: Array.from(room.users.values())
    });
  });

  // Handle chat messages
  socket.on('chat_message', (data) => {
    const { roomId, message } = data;
    // console.log('💬 Chat message in room:', roomId);
    
    // Broadcast message to all users in room
    io.to(roomId).emit('chat_message', {
      message,
      fromUserId: room.users.get(socket.id)?.id
    });
  });

  // Handle test sync
  socket.on('test_sync', (data) => {
    const { roomId } = data;
    // console.log('🧪 Test sync in room:', roomId);
    
    // Broadcast test to other users in room
    broadcastToRoom(roomId, 'test_sync', {
      message: 'Test sync received!',
      timestamp: Date.now()
    }, socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // console.log('🔌 User disconnected:', socket.id);
    
    // Find and remove user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        // Notify other users about user leaving
        if (room.users.size > 0) {
          broadcastToRoom(roomId, 'user_left', {
            user: {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
              leftAt: new Date().toISOString()
            }
          });
        }
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
          // console.log('🗑️ Cleaned up empty room:', roomId);
        }
      }
    });
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'VibeTune API Server is running!',
    status: 'ok',
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Get room info endpoint
app.get('/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId); // Use getRoom helper to create if doesn't exist
  
  const roomData = {
    roomId,
    users: Array.from(room.users.values()),
    queue: room.queue,
    isPlaying: room.isPlaying
  };
  
  // Only include currentSong if it's valid and has required fields
  if (room.currentSong && room.currentSong.id && room.currentSong.title && Object.keys(room.currentSong).length > 2) {
    roomData.currentSong = room.currentSong;
  }
  
  // Include computed currentTime when meaningful
  const computed = getComputedCurrentTime(room);
  if (computed > 0 || room.isPlaying) {
    roomData.currentTime = computed;
  }
  
  res.json(roomData);
});

// Sync endpoint for HTTP-based sync
app.post('/sync', (req, res) => {
  const { roomId, type, data } = req.body;
  // console.log('🔄 HTTP Sync:', type, 'for room:', roomId);
  
  if (!roomId || !type) {
    return res.status(400).json({ error: 'Missing roomId or type' });
  }
  
  const room = getRoom(roomId);
  
  // Update room state based on sync type
  switch (type) {
    case 'playPause':
      if (typeof data.isPlaying === 'boolean') {
        // Only update if the state is actually different
        if (room.isPlaying !== data.isPlaying) {
          // console.log(`🔄 Server: Updating play state from ${room.isPlaying} to ${data.isPlaying}`);
          room.isPlaying = data.isPlaying;
          if (room.isPlaying) {
            // starting playback: start server clock
            room.startedAt = Date.now();
          } else {
            // pausing: freeze position based on elapsed time
            room.currentTime = getComputedCurrentTime(room);
            room.startedAt = null;
          }
        }
      }
      if (data.currentSong && Object.keys(data.currentSong).length > 0) {
        // console.log(`🔄 Server: Updating current song to ${data.currentSong.title || 'Unknown'}`);
        room.currentSong = data.currentSong;
      }
      break;
    case 'songChange':
      if (data.currentSong && Object.keys(data.currentSong).length > 0) {
        // console.log(`🔄 Server: Changing song to ${data.currentSong.title || 'Unknown'}`);
        room.currentSong = data.currentSong;
        room.isPlaying = true;
        room.currentTime = 0;
        room.startedAt = Date.now();
      }
      break;
    case 'seek':
      if (data.currentPosition !== undefined) {
        room.currentTime = Math.max(0, Number(data.currentPosition) || 0);
        if (room.isPlaying) {
          room.startedAt = Date.now();
        }
      }
      break;
    case 'queueUpdate':
      if (data.queue) {
        room.queue = data.queue;
      }
      break;
  }
  
  // Broadcast to all connected users in the room via Socket.IO
  io.to(roomId).emit('sync_event', {
    type,
    payload: data,
    timestamp: Date.now()
  });
  
  res.json({ success: true, timestamp: Date.now() });
});

const PORT = process.env.PORT || 3001;
// console.log('🚀 Server starting on port:', PORT);

server.listen(PORT, () => {
  // console.log('🚀 Socket.IO server running on port:', PORT);
  // console.log('🌐 Health check: https://vibetune-production.up.railway.app/health');
});
