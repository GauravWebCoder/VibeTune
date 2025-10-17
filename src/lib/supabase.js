import { createClient } from '@supabase/supabase-js'

// Supabase configuration - use mock for local development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// For local development without Supabase, we'll create a mock client
export const createMockSupabase = () => {
  const rooms = new Map()
  const listeners = new Map()
  const mockData = {
    rooms: new Map(),
    room_users: new Map(),
    chat_messages: new Map(),
    songs: new Map()
  }
  
  return {
    channel: (channelName) => {
      const channel = {
        on: (event, config, callback) => {
          if (!listeners.has(channelName)) {
            listeners.set(channelName, new Map())
          }
          if (!listeners.get(channelName).has(event)) {
            listeners.get(channelName).set(event, [])
          }
          listeners.get(channelName).get(event).push({ config, callback })
        },
        send: (payload) => {
          // Simulate receiving the message
          setTimeout(() => {
            const channelListeners = listeners.get(channelName)
            if (channelListeners && channelListeners.has('broadcast')) {
              channelListeners.get('broadcast').forEach(({ callback }) => {
                callback({ payload })
              })
            }
          }, 100)
        },
        subscribe: () => {
          // console.log('📡 Mock Supabase channel subscribed:', channelName)
        },
        unsubscribe: () => {
          // console.log('📡 Mock Supabase channel unsubscribed:', channelName)
        }
      }
      return channel
    },
    from: (table) => {
      return {
        select: (columns = '*') => ({
          eq: (column, value) => ({
            single: () => {
              const data = mockData[table]?.get(value) || null
              return Promise.resolve({ data, error: null })
            },
            order: (column, options) => ({
              limit: (count) => {
                const allData = Array.from(mockData[table]?.values() || [])
                const filtered = allData.filter(item => {
                  if (table === 'chat_messages') return item.room_id === value
                  if (table === 'room_users') return item.room_id === value
                  return true
                })
                const sorted = filtered.sort((a, b) => {
                  if (options.ascending) return a[column] > b[column] ? 1 : -1
                  return a[column] < b[column] ? 1 : -1
                })
                return Promise.resolve({ data: sorted.slice(0, count), error: null })
              }
            })
          })
        }),
        insert: (data) => {
          if (table === 'chat_messages') {
            const message = {
              id: Date.now(),
              ...data,
              created_at: new Date().toISOString()
            }
            mockData[table].set(message.id, message)
            
            // Simulate real-time event
            setTimeout(() => {
              const channelListeners = listeners.get(`room-${data.room_id}`)
              if (channelListeners && channelListeners.has('postgres_changes')) {
                channelListeners.get('postgres_changes').forEach(({ config, callback }) => {
                  if (config.table === 'chat_messages' && config.event === 'INSERT') {
                    callback({ new: message })
                  }
                })
              }
            }, 100)
          }
          return Promise.resolve({ data: null, error: null })
        },
        upsert: (data, options) => {
          if (table === 'rooms') {
            mockData[table].set(data.id, data)
          } else if (table === 'room_users') {
            const key = `${data.room_id}-${data.user_id}`
            mockData[table].set(key, data)
            
            // Simulate real-time event
            setTimeout(() => {
              const channelListeners = listeners.get(`room-${data.room_id}`)
              if (channelListeners && channelListeners.has('postgres_changes')) {
                channelListeners.get('postgres_changes').forEach(({ config, callback }) => {
                  if (config.table === 'room_users' && config.event === 'INSERT') {
                    callback({ new: data })
                  }
                })
              }
            }, 100)
          }
          return Promise.resolve({ data: null, error: null })
        },
        update: (data) => ({
          eq: (column, value) => {
            if (table === 'rooms') {
              const existing = mockData[table].get(value)
              if (existing) {
                const updated = { ...existing, ...data }
                mockData[table].set(value, updated)
                
                // Simulate real-time event
                setTimeout(() => {
                  const channelListeners = listeners.get(`room-${value}`)
                  if (channelListeners && channelListeners.has('postgres_changes')) {
                    channelListeners.get('postgres_changes').forEach(({ config, callback }) => {
                      if (config.table === 'rooms' && config.event === 'UPDATE') {
                        callback({ new: updated })
                      }
                    })
                  }
                }, 100)
              }
            }
            return Promise.resolve({ data: null, error: null })
          }
        }),
        delete: () => ({
          eq: (column, value) => ({
            eq: (column2, value2) => {
              if (table === 'room_users') {
                const key = `${value}-${value2}`
                const userData = mockData[table].get(key)
                mockData[table].delete(key)
                
                // Simulate real-time event
                setTimeout(() => {
                  const channelListeners = listeners.get(`room-${value}`)
                  if (channelListeners && channelListeners.has('postgres_changes')) {
                    channelListeners.get('postgres_changes').forEach(({ config, callback }) => {
                      if (config.table === 'room_users' && config.event === 'DELETE') {
                        callback({ old: userData })
                      }
                    })
                  }
                }, 100)
              }
              return Promise.resolve({ data: null, error: null })
            }
          })
        })
      }
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: new Error('Storage disabled in mock environment') }),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    }
  }
}

// Check if we have real Supabase credentials
export const isSupabaseReal = Boolean(supabaseUrl && supabaseKey && 
  supabaseUrl !== 'your_supabase_project_url_here' && 
  supabaseKey !== 'your_supabase_anon_key_here')

// Create a single instance to avoid multiple clients
let supabaseInstance = null;

if (isSupabaseReal) {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Prevent multiple GoTrueClient instances
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 5
        },
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries) => Math.min(tries * 2000, 30000),
        timeout: 10000
      },
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      },
      db: {
        schema: 'public'
      }
    });
    // console.log('🔧 Supabase status: Real client (new instance)');
  } else {
    // console.log('🔧 Supabase status: Real client (existing instance)');
  }
} else {
  supabaseInstance = createMockSupabase();
  // console.log('🔧 Supabase status: Mock client');
}

// console.log('🔧 Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
// console.log('🔧 Supabase Key:', supabaseKey ? 'Set' : 'Not set');

// Export the client
export const supabase = supabaseInstance;
export const supabaseClient = supabaseInstance;

// Helper: upload audio file to public bucket and return public URL
export async function uploadAudioToSupabase(file, roomId, userId, bucket = 'songs') {
  // console.log('📤 Starting upload process for:', file.name);
  // console.log('📤 Supabase status:', isSupabaseReal ? 'Real' : 'Mock');
  // console.log('📤 File details:', { size: file.size, type: file.type });
  
  // Validate file
  if (!file || file.size === 0) {
    throw new Error('Invalid file: empty or null file');
  }
  
  if (!file.type.startsWith('audio/')) {
    throw new Error('Invalid file type: not an audio file');
  }
  
  if (!isSupabaseReal) {
    // console.log('📤 Using local blob URL (no Supabase configured)');
    // Return a local blob URL for mock environment
    const blobUrl = URL.createObjectURL(file);
    // console.log('✅ Created local blob URL:', blobUrl);
    return { 
      publicUrl: blobUrl, 
      path: `local/${Date.now()}_${file.name}`,
      isLocal: true 
    };
  }
  
  // console.log('📤 Uploading to Supabase storage:', file.name);
  const safeRoom = String(roomId || 'room').replace(/[^a-zA-Z0-9-_]/g, '_')
  const safeName = String(file.name || 'audio').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9.-]/g, '_')
  const timestamp = Date.now()
  const randomId = Math.floor(Math.random()*1e6)
  const path = `${safeRoom}/${userId || 'anon'}_${timestamp}_${randomId}_${safeName}`

  try {
    // console.log('📤 Uploading to path:', path);
    
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '31536000',
      upsert: false, // Don't overwrite existing files
      contentType: file.type || 'audio/mpeg'
    })
    
    if (upErr) {
      // console.error('❌ Upload error:', upErr);
      if (upErr.message && upErr.message.includes('Bucket not found')) {
        throw new Error('Storage bucket "songs" not found. Please create it in your Supabase dashboard.');
      }
      throw upErr;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    const publicUrl = data?.publicUrl
    if (!publicUrl) throw new Error('Failed to get public URL')
    
    // console.log('✅ Upload successful:', publicUrl);
    
    // Note: Songs table not available, but upload still works
    // console.log('✅ Upload complete - file available at:', publicUrl);
    
    return { publicUrl, path, isLocal: false }
  } catch (error) {
    // console.error('❌ Supabase upload failed:', error);
    // console.log('📤 Falling back to local blob URL');
    // Fallback to local blob URL
    const blobUrl = URL.createObjectURL(file);
    // console.log('✅ Created fallback blob URL:', blobUrl);
    return { 
      publicUrl: blobUrl, 
      path: `fallback/${Date.now()}_${file.name}`,
      isLocal: true 
    };
  }
}

// Helper: sync room data with Supabase
export async function syncRoomWithSupabase(roomId, roomData) {
  if (!isSupabaseReal) {
    // console.log('📡 Supabase not configured, skipping room sync');
    return;
  }

  try {
    // console.log('📡 Syncing room data to Supabase:', roomId);
    
    const { error } = await supabase
      .from('rooms')
      .upsert({
        id: roomId,
        name: roomData.name || `Room ${roomId}`,
        host_id: roomData.hostId,
        updated_at: new Date().toISOString()
      });

    if (error) {
      // console.warn('⚠️ Room sync failed:', error);
    } else {
      // console.log('✅ Room synced to Supabase');
    }
  } catch (error) {
    // console.warn('⚠️ Room sync error:', error);
  }
}

// Helper: sync user join/leave with Supabase
export async function syncUserWithRoom(roomId, userId, username, action = 'join') {
  if (!isSupabaseReal) {
    // console.log('📡 Supabase not configured, skipping user sync');
    return;
  }

  try {
    // console.log(`📡 Syncing user ${action} to Supabase:`, { roomId, userId, username });
    
    if (action === 'join') {
      const { error } = await supabase
        .from('room_users')
        .upsert({
          room_id: roomId,
          user_id: userId,
          username: username,
          joined_at: new Date().toISOString()
        });

      if (error) {
        // console.warn('⚠️ User join sync failed:', error);
      } else {
        // console.log('✅ User join synced to Supabase');
      }
    } else if (action === 'leave') {
      const { error } = await supabase
        .from('room_users')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) {
        // console.warn('⚠️ User leave sync failed:', error);
      } else {
        // console.log('✅ User leave synced to Supabase');
      }
    }
  } catch (error) {
    // console.warn('⚠️ User sync error:', error);
  }
}
