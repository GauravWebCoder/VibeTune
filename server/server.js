const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const { execFile } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

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
const streamCache = new Map();

function isValidYouTubeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

function getPipedInstances() {
  const raw = process.env.PIPED_BASES || process.env.PIPED_BASE || '';
  const list = raw.split(',').map(v => v.trim()).filter(Boolean);
  if (list.length > 0) return list;
  return [
    'https://piped.video',
    'https://pipedapi.kavin.rocks',
    'https://piped.mha.fi',
    'https://piped.projectsegfau.lt',
    'https://piped.privacydev.net'
  ];
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? http : https;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          const error = new Error(`Request failed: ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.body = data;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function proxyStream(url, req, res) {
  const client = url.startsWith('http://') ? http : https;
  const headers = {};
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const upstream = client.get(url, { headers }, (upRes) => {
    res.statusCode = upRes.statusCode || 200;
    const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    passthroughHeaders.forEach((h) => {
      if (upRes.headers[h]) {
        res.setHeader(h, upRes.headers[h]);
      }
    });
    upRes.pipe(res);
  });

  upstream.on('error', (err) => {
    // console.error('Upstream proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Upstream stream failed' });
    } else {
      res.end();
    }
  });
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || '').trim());
    });
  });
}

function runYtDlpViaPython3(args) {
  return new Promise((resolve, reject) => {
    execFile('python3', ['-m', 'yt_dlp', ...args], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || '').trim());
    });
  });
}

function runYtDlpViaPython(args) {
  return new Promise((resolve, reject) => {
    execFile('python', ['-m', 'yt_dlp', ...args], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || '').trim());
    });
  });
}

function runYtDlpViaPyLauncher(args) {
  return new Promise((resolve, reject) => {
    execFile('py', ['-3', '-m', 'yt_dlp', ...args], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || '').trim());
    });
  });
}

const YT_URL_CACHE_TTL_MS = Number(process.env.YT_URL_CACHE_TTL_MS || 10 * 60 * 1000);
const ytUrlCache = new Map();

function getCachedYtUrl(videoId) {
  const entry = ytUrlCache.get(videoId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    ytUrlCache.delete(videoId);
    return null;
  }
  return entry.url;
}

function setCachedYtUrl(videoId, url) {
  if (!videoId || !url) return;
  ytUrlCache.set(videoId, {
    url,
    expiresAt: Date.now() + YT_URL_CACHE_TTL_MS
  });
}

async function getYtDlpAudioUrl(videoId) {
  const cached = getCachedYtUrl(videoId);
  if (cached) return cached;

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const args = [
    '--no-playlist',
    '--no-warnings',
    '-f', 'bestaudio',
    '-g',
    watchUrl
  ];

  let output = '';
  const attempts = [
    { label: 'yt-dlp', fn: () => runYtDlp(args) },
    { label: 'python3 -m yt_dlp', fn: () => runYtDlpViaPython3(args) },
    { label: 'python -m yt_dlp', fn: () => runYtDlpViaPython(args) },
    { label: 'py -3 -m yt_dlp', fn: () => runYtDlpViaPyLauncher(args) }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      output = await attempt.fn();
      if (output) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!output && lastError) {
    throw lastError;
  }

  if (!output) {
    throw new Error('yt-dlp returned empty output');
  }
  const url = output.split(/\r?\n/)[0].trim();
  if (!url.startsWith('http')) {
    throw new Error('yt-dlp returned invalid URL');
  }
  setCachedYtUrl(videoId, url);
  return url;
}

async function getYtDlpPlaylistItems(listId, limit = 50) {
  const playlistUrl = `https://www.youtube.com/playlist?list=${listId}`;
  const args = [
    '--flat-playlist',
    '-J',
    playlistUrl
  ];

  let output = '';
  try {
    output = await runYtDlp(args);
  } catch (err) {
    try {
      output = await runYtDlpViaPython(args);
    } catch (pyErr) {
      output = await runYtDlpViaPyLauncher(args);
    }
  }

  if (!output) {
    throw new Error('yt-dlp playlist returned empty output');
  }

  let data = null;
  try {
    data = JSON.parse(output);
  } catch (e) {
    throw new Error('yt-dlp playlist JSON parse failed');
  }

  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const items = entries
    .filter(e => e?.id)
    .slice(0, limit)
    .map(e => ({
      ytId: e.id,
      title: e.title || 'Unknown',
      artist: e.uploader || e.channel || 'YouTube',
      thumbnail: e.id ? `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg` : ''
    }));

  return items;
}

async function listAllStorageFiles(client, bucket, prefix = '') {
  const files = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      const isFile = Boolean(item.id || item.metadata);
      if (isFile) {
        files.push({ path: itemPath, meta: item });
      } else {
        const nested = await listAllStorageFiles(client, bucket, itemPath);
        files.push(...nested);
      }
    }

    offset += data.length;
  }

  return files;
}

function startSupabaseCleanup() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'songs';
  const retentionDays = Number(process.env.UPLOAD_RETENTION_DAYS || 3);
  const intervalHours = Number(process.env.CLEANUP_INTERVAL_HOURS || 6);

  if (!supabaseUrl || !serviceKey || !retentionDays || retentionDays <= 0) {
    return;
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const runCleanup = async () => {
    try {
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const files = await listAllStorageFiles(client, bucket);
      const toDelete = files
        .filter(f => {
          const meta = f.meta || {};
          const dateStr = meta.updated_at || meta.created_at || meta.last_modified || meta.modified_at || meta.inserted_at;
          const ts = dateStr ? new Date(dateStr).getTime() : 0;
          return ts > 0 && ts < cutoff;
        })
        .map(f => f.path);

      for (let i = 0; i < toDelete.length; i += 100) {
        const chunk = toDelete.slice(i, i + 100);
        await client.storage.from(bucket).remove(chunk);
      }
    } catch (err) {
      // console.error('Supabase cleanup failed:', err?.message || err);
    }
  };

  const runChatCleanup = async () => {
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      await client
        .from('chat_messages')
        .delete()
        .lt('created_at', cutoff);
    } catch (err) {
      // console.error('Supabase chat cleanup failed:', err?.message || err);
    }
  };

  runCleanup();
  runChatCleanup();
  setInterval(() => {
    runCleanup();
    runChatCleanup();
  }, intervalHours * 60 * 60 * 1000);
}

async function fetchPipedSearch(query, limit) {
  const instances = getPipedInstances();
  let lastError = null;
  for (const base of instances) {
    try {
      const pipedUrl = `${base}/api/v1/search?q=${encodeURIComponent(query)}&region=US`;
      const data = await fetchJson(pipedUrl);
      const items = Array.isArray(data) ? data : data?.items || [];
      const results = items
        .filter(v => v?.url || v?.id || v?.videoId)
        .slice(0, limit)
        .map(v => {
          const videoId = v?.id || v?.videoId || v?.shortsId || (v?.url ? v.url.replace('/watch?v=', '').split('&')[0] : '');
          return {
            ytId: videoId,
            title: v?.title || 'Unknown',
            artist: v?.uploader || v?.author || 'YouTube',
            thumbnail: v?.thumbnail || v?.thumbnailUrl || v?.thumbnailSrc || ''
          };
        })
        .filter(it => it.ytId);
      return results;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return [];
}

async function fetchPipedStreamUrl(videoId) {
  const instances = getPipedInstances();
  let lastError = null;
  for (const base of instances) {
    try {
      const data = await fetchJson(`${base}/api/v1/streams/${videoId}`);
      const streams = Array.isArray(data?.audioStreams) ? data.audioStreams : [];
      const best = streams
        .filter(s => s?.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (best?.url) {
        return { url: best.url, mimeType: best?.mimeType || 'audio/mpeg' };
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  throw new Error('No Piped stream available');
}

function getCachedStream(videoId) {
  const cached = streamCache.get(videoId);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt > Date.now() + 30_000) {
    return cached.audioUrl;
  }
  streamCache.delete(videoId);
  return null;
}

function cacheStream(videoId, audioUrl) {
  const match = /[?&]expire=(\d+)/.exec(audioUrl || '');
  const expiresAt = match ? Number(match[1]) * 1000 : Date.now() + 5 * 60 * 1000;
  streamCache.set(videoId, { audioUrl, expiresAt });
}

// Helper function to get or create room
function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      queue: [],
      currentSong: null,
      isPlaying: false,
      shuffleMode: false,
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
      shuffleMode: room.shuffleMode,
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
      case 'shuffle':
        if (typeof payload.shuffleMode === 'boolean') {
          room.shuffleMode = payload.shuffleMode;
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

    const computedTime = getComputedCurrentTime(room);

    // Broadcast to other users in room
    broadcastToRoom(roomId, 'sync_event', {
      type,
      payload: { ...payload, currentTime: payload?.currentTime ?? payload?.currentPosition ?? computedTime },
      fromUserId: room.users.get(socket.id)?.id
    }, socket.id);

    // Also send a consolidated room_state snapshot back to the sender
    io.to(socket.id).emit('room_state', {
      queue: room.queue,
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      shuffleMode: room.shuffleMode,
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

// YouTube search (via API key or Piped fallback)
app.get('/api/youtube/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 10;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 25) : 10;

  if (!q) {
    return res.status(400).json({ error: 'Missing query' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || '';
  try {
    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(q)}&key=${apiKey}`;
      const data = await fetchJson(apiUrl);
      const items = (data?.items || []).map(it => ({
        ytId: it?.id?.videoId,
        title: it?.snippet?.title || 'Unknown',
        artist: it?.snippet?.channelTitle || 'YouTube',
        thumbnail: it?.snippet?.thumbnails?.medium?.url || it?.snippet?.thumbnails?.default?.url || ''
      })).filter(it => it.ytId);
      return res.json({ items });
    }

    const results = await fetchPipedSearch(q, limit);
    return res.json({ items: results });
  } catch (error) {
    return res.status(500).json({ error: 'YouTube search failed' });
  }
});

// YouTube playlist (yt-dlp)
app.get('/api/youtube/playlist', async (req, res) => {
  const listId = typeof req.query.list === 'string' ? req.query.list.trim() : '';
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 300;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 300;

  if (!listId) {
    return res.status(400).json({ error: 'Missing list id' });
  }

  try {
    const items = await getYtDlpPlaylistItems(listId, limit);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: 'Playlist fetch failed' });
  }
});

// YouTube audio stream URL resolver (proxy path)
app.get('/api/youtube/streams/:id', async (req, res) => {
  const videoId = req.params.id;
  if (!videoId || !isValidYouTubeId(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    return res.json({ audioUrl: `/api/youtube/stream/${videoId}` });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch YouTube stream' });
  }
});

// YouTube audio URL resolver (warm cache, no stream)
app.get('/api/youtube/resolve/:id', async (req, res) => {
  const videoId = req.params.id;
  if (!videoId || !isValidYouTubeId(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    const url = await getYtDlpAudioUrl(videoId);
    return res.json({ url });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to resolve YouTube audio' });
  }
});

// YouTube audio stream proxy (CORS-safe)
app.get('/api/youtube/stream/:id', async (req, res) => {
  const videoId = req.params.id;
  if (!videoId || !isValidYouTubeId(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

  try {
    if (String(req.query.warm || '') === '1') {
      await getYtDlpAudioUrl(videoId);
      return res.status(204).end();
    }
    const url = await getYtDlpAudioUrl(videoId);
    res.setHeader('Accept-Ranges', 'bytes');
    return proxyStream(url, req, res);
  } catch (error) {
    console.error('yt-dlp failed, trying Piped fallback:', error?.message || error);
    try {
      const stream = await fetchPipedStreamUrl(videoId);
      res.setHeader('Content-Type', (stream?.mimeType || 'audio/mpeg').split(';')[0]);
      res.setHeader('Accept-Ranges', 'bytes');
      if (stream?.url) {
        setCachedYtUrl(videoId, stream.url);
      }
      return proxyStream(stream.url, req, res);
    } catch (fallbackError) {
      console.error('Piped fallback failed:', fallbackError?.message || fallbackError);
      return res.status(500).json({ error: 'Failed to stream YouTube audio' });
    }
  }
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
    isPlaying: room.isPlaying,
    shuffleMode: room.shuffleMode
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

startSupabaseCleanup();
