import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayback } from '../hooks/usePlayback';
import { supabase, isSupabaseReal } from '../lib/supabase';
import serverSync from '../utils/serverSync';
import { uploadAudioToSupabase } from '../lib/supabase';
import { resolveUrlOrSearch } from '../utils/media-resolver';

export default function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { 
    currentSong, 
    setCurrentSong, 
    queue, 
    updateQueue,
    isPlaying,
    play,
    pause,
    audioRef,
    shuffleMode,
    toggleShuffle,
    setShuffleModeState,
    preloadSong,
    setPendingSeek,
    setSkipNextCallback,
    resetPlayback
  } = usePlayback();
  
  // Room state
  const [roomUsers, setRoomUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [realtimeDisabled, setRealtimeDisabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearchSection, setShowSearchSection] = useState(false);
  const uploadsEnabled = import.meta.env.VITE_ENABLE_UPLOADS === 'true';
  const [isPlaylistSearch, setIsPlaylistSearch] = useState(false);
  const [searchVisibleCount, setSearchVisibleCount] = useState(20);
  const [queueVisibleCount, setQueueVisibleCount] = useState(50);
  
  // Refs
  const channelRef = useRef(null);
  const lastActionTimeRef = useRef(0);
  const seenMessageIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const lastConnectionTimeRef = useRef(0);
  const isConnectingRef = useRef(false);
  
  // Use refs to avoid stale closures in useEffect
  const currentSongRef = useRef(currentSong);
  const isPlayingRef = useRef(isPlaying);
  const playRef = useRef(play);
  const pauseRef = useRef(pause);
  const updateQueueRef = useRef(updateQueue);
  const syncSetupRef = useRef(false);
  const lastSeekTimeRef = useRef(0);
  const queueRef = useRef(queue);
  const lastPlayPauseSyncRef = useRef(0);
  const isLeaderRef = useRef(false);
  const latestRoomDataRef = useRef(null);
  const lastRemoteAdjustRef = useRef(0);
  const lastShuffleAtRef = useRef(0);
  const lastPrewarmIdsRef = useRef([]);
  const lastSongChangeAtRef = useRef(0);
  const lastUsersRef = useRef([]);

  const getNextSongFromQueue = useCallback((song, queueList) => {
    const currentQueue = Array.isArray(queueList) ? queueList : queueRef.current;
    if (!song || !currentQueue || currentQueue.length === 0) return null;
    const currentIndex = currentQueue.findIndex(item => item.id === song.id);
    if (currentIndex === -1) return currentQueue[0] || null;
    const nextIndex = (currentIndex + 1) % currentQueue.length;
    return currentQueue[nextIndex] || null;
  }, []);

  
  // Update refs when values change
  useEffect(() => {
    currentSongRef.current = currentSong;
    isPlayingRef.current = isPlaying;
    playRef.current = play;
    pauseRef.current = pause;
    updateQueueRef.current = updateQueue;
    queueRef.current = queue;
  }, [currentSong, isPlaying, play, pause, updateQueue, queue]);

  const normalizeSocketUsers = useCallback((users) => {
    const map = new Map();
    (users || []).forEach((u) => {
      const id = u?.user_id || u?.id;
      if (!id) return;
      map.set(id, {
        user_id: id,
        username: u?.username || 'User',
        avatar: u?.avatar || '/music img.png'
      });
    });
    return Array.from(map.values());
  }, []);

  useEffect(() => {
    if (!currentSong) return;
    const nextSong = getNextSongFromQueue(currentSong, queueRef.current);
    if (nextSong) {
      preloadSong(nextSong);
    }
  }, [currentSong, queue, preloadSong, getNextSongFromQueue]);

  useEffect(() => {
    if (!currentSong || !queueRef.current?.length) return;
    const currentQueue = queueRef.current;
    const currentIndex = currentQueue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1) return;

    const nextCandidates = [];
    for (let i = 1; i <= 2; i++) {
      const candidate = currentQueue[(currentIndex + i) % currentQueue.length];
      if (candidate) nextCandidates.push(candidate);
    }

    const nextIds = nextCandidates.map(song => song.id).filter(Boolean);
    const lastIds = lastPrewarmIdsRef.current || [];
    const isSame = nextIds.length === lastIds.length && nextIds.every((id, idx) => id === lastIds[idx]);
    if (isSame) return;

    lastPrewarmIdsRef.current = nextIds;
    setTimeout(() => {
      nextCandidates.forEach(song => preloadSong(song));
    }, 200);
  }, [currentSong, queue, preloadSong]);

  const shuffleQueue = useCallback(() => {
    const currentQueue = queueRef.current || [];
    if (!Array.isArray(currentQueue) || currentQueue.length <= 1) return;

    const activeSong = currentSongRef.current;
    const rest = activeSong?.id
      ? currentQueue.filter(song => song.id !== activeSong.id)
      : [...currentQueue];

    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    const newQueue = activeSong?.id ? [activeSong, ...rest] : rest;
    queueRef.current = newQueue;
    if (updateQueueRef.current) {
      updateQueueRef.current(newQueue);
    }

    if (isSupabaseReal) {
      supabase
        .from('rooms')
        .update({
          queue: newQueue,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .then(() => {})
        .catch(() => {});
    }

    if (window.roomSync) {
      window.roomSync.broadcastQueueUpdate(newQueue);
    }
    lastShuffleAtRef.current = Date.now();
  }, [roomId]);

  const removeSongFromQueue = useCallback((songId) => {
    if (!songId) return;
    const currentQueue = queueRef.current || [];
    const newQueue = currentQueue.filter(song => song.id !== songId);
    if (newQueue.length === currentQueue.length) return;

    queueRef.current = newQueue;
    if (updateQueueRef.current) {
      updateQueueRef.current(newQueue);
    }

    if (isSupabaseReal) {
      supabase
        .from('rooms')
        .update({
          queue: newQueue,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .then(() => {})
        .catch(() => {});
    }

    if (window.roomSync) {
      window.roomSync.broadcastQueueUpdate(newQueue);
    }
  }, [roomId]);
  
  // Initialize room
  useEffect(() => {
    if (!user || !roomId) return;
    
    // Reset playback state when entering a new room
    resetPlayback();
    
    initializeRoom();
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      isConnectingRef.current = false;
    };
  }, [user, roomId, resetPlayback]);

  // Determine leader (earliest joined user) and expose to window
  useEffect(() => {
    try {
      if (roomUsers && roomUsers.length > 0 && user) {
        const sorted = [...roomUsers].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
        const leaderId = sorted[0]?.user_id;
        isLeaderRef.current = leaderId === user.id;
        window.roomRole = { isLeader: isLeaderRef.current };
      }
    } catch (_) {
      // ignore
    }
  }, [roomUsers, user]);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Set up skip next callback
  useEffect(() => {
    setSkipNextCallback(() => {
      handleSkipNext();
    });
  }, [setSkipNextCallback]);

  // Server-based sync system
  useEffect(() => {
    // Setting up server sync
    
    // Join the room with user info for socket presence
    serverSync.joinRoom(roomId, {
      id: user?.id,
      username: user?.username,
      avatar: user?.avatar || '/music img.png'
    });
    
    // Disable periodic progress hints to prevent loops
    const progressSyncInterval = null;
    
    // Listen for room updates
    const unsubscribe = serverSync.on('roomUpdate', (data) => {
      // Process updates silently
      latestRoomDataRef.current = data;
      
        // Handle play/pause updates
        if (typeof data.isPlaying === 'boolean') {
          const now = Date.now();
          if (data.fromUserId && data.fromUserId === user?.id) {
            return;
          }
          if (data.isPlaying && data.isPlaying === isPlayingRef.current) {
            return;
          }
          if (!data.isPlaying && (now - lastSongChangeAtRef.current < 800)) {
            return;
          }
          lastPlayPauseSyncRef.current = now;
          isPlayingRef.current = data.isPlaying;
          
          if (data.isPlaying) {
            playRef.current();
          } else {
            if (data?.currentTime !== undefined) {
              setPendingSeek(Number(data.currentTime) || 0);
            }
            pauseRef.current();
          }
        }

        // Handle live user list from socket room_state
        if (Array.isArray(data.users)) {
          const normalized = normalizeSocketUsers(data.users);
          const prev = lastUsersRef.current || [];
          const prevIds = new Set(prev.map(u => u.user_id));
          const nextIds = new Set(normalized.map(u => u.user_id));

          // Joined users
          normalized.forEach(u => {
            if (!prevIds.has(u.user_id) && u.user_id !== user?.id) {
              showNotification(`${u.username} joined the room`);
              setMessages(prevMsgs => [...prevMsgs, {
                id: `system_join_${Date.now()}_${u.user_id}`,
                user_id: 'system',
                username: 'System',
                avatar: '/music img.png',
                message: `🎉 ${u.username} joined the room!`,
                created_at: new Date().toISOString(),
                is_system: true
              }]);
            }
          });

          // Left users
          prev.forEach(u => {
            if (!nextIds.has(u.user_id) && u.user_id !== user?.id) {
              showNotification(`${u.username} left the room`);
              setMessages(prevMsgs => [...prevMsgs, {
                id: `system_leave_${Date.now()}_${u.user_id}`,
                user_id: 'system',
                username: 'System',
                avatar: '/music img.png',
                message: `👋 ${u.username} left the room`,
                created_at: new Date().toISOString(),
                is_system: true
              }]);
            }
          });

          lastUsersRef.current = normalized;
          setRoomUsers(normalized);
        }
      
        // Handle song changes - ONLY if we have a valid song
        if (data.currentSong && data.currentSong.id && data.currentSong.id !== currentSongRef.current?.id) {
          setCurrentSong(data.currentSong);
          currentSongRef.current = data.currentSong;
          lastSongChangeAtRef.current = Date.now();
          
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          
          // Force align time and play state after load
          setTimeout(() => {
            if (data?.currentTime !== undefined) {
              setPendingSeek(Number(data.currentTime) || 0);
            }
            if (data?.isPlaying === false) {
              pauseRef.current();
            } else {
              try { playRef.current(); } catch {}
            }
          }, 250);
        }

        // If joining and same song already set, still align time and play state
        if (data?.type === 'room_state' && data?.currentSong?.id === currentSongRef.current?.id) {
          if (data?.currentTime !== undefined) {
            setPendingSeek(Number(data.currentTime) || 0);
          }
          if (data?.isPlaying === false) {
            pauseRef.current();
          } else {
            try { playRef.current(); } catch {}
          }
        }

        // On explicit song_change events, force play unless room is paused
        if (data?.type === 'song_change') {
          lastSongChangeAtRef.current = Date.now();
          if (data?.isPlaying === false) {
            pauseRef.current();
          } else {
            try { playRef.current(); } catch {}
          }
        }
      
      // Do not touch audio time here; FooterPlayer exclusively manages time to avoid loops
      
      // Call server sync callback for progress bar
      if (window.roomSyncServerCallback) {
        window.roomSyncServerCallback(data);
      }
      
      // IGNORE position 0 resets from remote updates
      
      // Handle queue updates - apply even when empty so joiners see clears
      if (data.queue && Array.isArray(data.queue)) {
        const currentQueue = queueRef.current;
        const isDifferent = data.queue.length !== currentQueue.length || 
          data.queue.some((song, index) => !currentQueue[index] || song.id !== currentQueue[index].id);
        const shouldApplyEmpty = data.queue.length > 0 || currentQueue.length === 0 || data.forceQueueClear;
        
        if (isDifferent && shouldApplyEmpty) {
          // Update ref first to prevent conflicts
          queueRef.current = data.queue;
          // Then update state
          updateQueue(data.queue);
        }
      }

      // Handle shuffle updates
      if (typeof data.shuffleMode === 'boolean' && data.shuffleMode !== shuffleMode) {
        setShuffleModeState(data.shuffleMode);
      }
    });
    
    // Store broadcast functions globally for footer player
    window.roomSync = {
      broadcastPlayPause: (isPlaying) => {
        const currentTime = audioRef.current ? audioRef.current.currentTime : 0;
        serverSync.broadcastPlayPause(isPlaying, currentSongRef.current, currentTime);
      },
      broadcastSongChange: (song) => {
        serverSync.broadcastSongChange(song);
      },
      broadcastSeek: (currentTime) => {
        serverSync.broadcastSeek(currentTime);
      },
      broadcastQueueUpdate: (queue) => {
        serverSync.broadcastQueueUpdate(queue);
      },
      broadcastShuffle: (mode) => {
        serverSync.broadcastShuffleMode(mode);
      },
      shuffleQueue: () => {
        shuffleQueue();
      },
      onServerSync: (callback) => {
        // Store callback for progress bar sync
        window.roomSyncServerCallback = callback;
        // Immediately deliver latest room data if available
        if (latestRoomDataRef.current) {
          try { callback(latestRoomDataRef.current); } catch (_) {}
        }
      }
    };
    
    // Store room control functions globally for footer player
    window.roomControls = {
      skipNext: handleSkipNext,
      skipPrevious: handleSkipPrevious,
      playSong: playSong
    };
    
    // Room controls set for footer player

    return () => {
      if (progressSyncInterval) {
        clearInterval(progressSyncInterval);
      }
      unsubscribe();
      serverSync.leaveRoom();
      delete window.roomSync;
      delete window.roomControls;
    };
  }, [roomId]);
  
  const initializeSupabaseRoom = async () => {
    try {
      // Ensure room exists
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomId)
        .maybeSingle();
      
      if (!roomData) {
        // Create room if it doesn't exist
        const { error: createError } = await supabase
          .from('rooms')
          .upsert({
            id: roomId,
            name: `Room ${roomId}`,
            host_id: user.id,
            host_username: user.username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
        
        if (createError) {
          // Error creating room
    }
      }
      
      // Add user to room
      const { error: userError } = await supabase
        .from('room_users')
        .upsert({
          room_id: roomId,
          user_id: user.id,
          username: user.username,
          avatar: user.avatar || '/music img.png',
          joined_at: new Date().toISOString()
        }, {
          onConflict: 'room_id,user_id'
        });
      
      if (userError) {
        // Error adding user to room
      }
    } catch (error) {
      // Error initializing Supabase room
    }
  };

  const initializeRoom = async () => {
    try {
      setConnectionStatus('connecting');
      
      // Initialize room in Supabase for user management
      await initializeSupabaseRoom();
      
      // User management handled in initializeSupabaseRoom
      
      // Set up real-time channel
      setupRealtimeChannel();
      
      // Load room state
      loadRoomState();
      
      // Load users
      loadRoomUsers();
      
      // Load messages
      loadMessages();
      
      setConnectionStatus('connected');
      
      } catch (error) {
      // Error initializing room
      setConnectionStatus('error');
    }
  };
  
  const setupRealtimeChannel = () => {
    if (!isSupabaseReal) {
      setConnectionStatus('offline');
      return;
    }
    
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      // Connection already in progress, skipping
      return;
    }
    
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // Limit retry attempts to prevent infinite loops
    if (retryCountRef.current >= 3) {
      // console.warn('📡 Max retry attempts reached, giving up on realtime connection');
      setConnectionStatus('offline');
      return;
    }
    
    // Check if connection was recently established (within 5 seconds)
    const now = Date.now();
    if (now - lastConnectionTimeRef.current < 5000) {
      // Connection was recently established, skipping retry
      return;
    }
    
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
    
    try {
      isConnectingRef.current = true;
      // Setting up realtime channel
      setConnectionStatus('connecting');
    
    channelRef.current = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, handleRoomUpdate)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_users',
        filter: `room_id=eq.${roomId}`
      }, handleUserJoined)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'room_users',
        filter: `room_id=eq.${roomId}`
      }, handleUserLeft)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        }, handleNewMessage)
        .subscribe((status) => {
          // Realtime subscription status
          isConnectingRef.current = false;
          
          if (status === 'SUBSCRIBED') {
            // Realtime connected successfully
            setConnectionStatus('connected');
            retryCountRef.current = 0; // Reset retry count on success
            lastConnectionTimeRef.current = Date.now();
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            // console.warn('📡 Realtime channel error, will retry...');
            setConnectionStatus('error');
            retryCountRef.current++;
            
            // Only retry if we haven't exceeded the limit
            if (retryCountRef.current < 3) {
              const retryDelay = Math.min(5000 * retryCountRef.current, 15000);
              
              retryTimeoutRef.current = setTimeout(() => {
                if (isSupabaseReal && retryCountRef.current < 3) {
                  setupRealtimeChannel();
                } else {
                  // console.warn('📡 Max retry attempts reached, using offline mode');
                  setConnectionStatus('offline');
                }
              }, retryDelay);
            } else {
              // console.warn('📡 Max retry attempts reached, disabling realtime');
              setConnectionStatus('offline');
              setRealtimeDisabled(true);
            }
          } else if (status === 'TIMED_OUT') {
            // console.warn('📡 Realtime connection timed out');
            setConnectionStatus('connecting');
            retryCountRef.current++;
            
            if (retryCountRef.current < 3) {
              retryTimeoutRef.current = setTimeout(() => {
                if (isSupabaseReal && retryCountRef.current < 3) {
                  setupRealtimeChannel();
                } else {
                  // console.warn('📡 Max retry attempts reached, using offline mode');
                  setConnectionStatus('offline');
                }
              }, 3000);
            } else {
              // console.warn('📡 Max retry attempts reached, disabling realtime');
              setConnectionStatus('offline');
              setRealtimeDisabled(true);
            }
          }
        });
    } catch (error) {
      // console.error('📡 Error setting up realtime channel:', error);
      isConnectingRef.current = false;
      setConnectionStatus('error');
      retryCountRef.current++;
      
      if (retryCountRef.current < 3) {
        retryTimeoutRef.current = setTimeout(() => {
          if (isSupabaseReal && retryCountRef.current < 3) {
            setupRealtimeChannel();
          } else {
            // console.warn('📡 Max retry attempts reached, using offline mode');
            setConnectionStatus('offline');
          }
        }, 5000);
      } else {
        // console.warn('📡 Max retry attempts reached, disabling realtime');
        setConnectionStatus('offline');
        setRealtimeDisabled(true);
      }
    }
  };
  
  const handleRoomUpdate = (payload) => {
    const data = payload.new;
    const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
    
    // Room update received from other user
    // Time since last action
    
    // Only process updates if they're not from our recent actions
    if (timeSinceLastAction < 2000) {
      // Ignoring update - too recent
      return;
    }
      
      // Update current song
    if (data.current_song && data.current_song.id !== currentSong?.id) {
      // Updating song from other user
      setCurrentSong(data.current_song);
      }
      
      // Update playing state
    if (typeof data.is_playing === 'boolean' && data.is_playing !== isPlaying) {
      // Updating play state from other user
      if (data.is_playing) {
        // Other user started playing, starting locally
          play();
      } else {
        // Other user paused, pausing locally
          pause();
        }
      }
    
    // Disable Supabase-driven seeks to prevent conflicts with socket/server clock
    // FooterPlayer handles all seek application via socket events
      
    // Update queue
    if (data.queue && Array.isArray(data.queue)) {
      // Updating queue from other user
      updateQueue(data.queue);
    }
  };
  
  const handleNewMessage = (payload) => {
    const message = payload.new;
    // Only add messages from other users to avoid duplicates
    if (message && message.user_id !== user.id && !seenMessageIdsRef.current.has(message.id)) {
      seenMessageIdsRef.current.add(message.id);
      setMessages(prev => [...prev, message]);
      // Auto-scroll to bottom when new message arrives
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };
  
  const handleUserJoined = (payload) => {
    const userData = payload.new;
    if (userData.user_id !== user.id) {
        setRoomUsers(prev => {
        const exists = prev.find(u => u.user_id === userData.user_id);
        return exists ? prev : [...prev, userData];
      });
      
      // Show notification
      showNotification(`${userData.username} joined the room!`);
      
      // Add system message to chat
      const systemMessage = {
        id: `system_join_${Date.now()}_${userData.user_id}`,
        user_id: 'system',
        username: 'System',
        avatar: '/music img.png',
        message: `🎉 ${userData.username} joined the room!`,
        created_at: new Date().toISOString(),
        is_system: true
      };
      setMessages(prev => [...prev, systemMessage]);
    }
  };
  
  const handleUserLeft = (payload) => {
    const userData = payload.old;
    if (userData.user_id !== user.id) {
      setRoomUsers(prev => prev.filter(u => u.user_id !== userData.user_id));
      showNotification(`${userData.username} left the room`);
      
      // Add system message to chat
      const systemMessage = {
        id: `system_leave_${Date.now()}_${userData.user_id}`,
        user_id: 'system',
        username: 'System',
        avatar: '/music img.png',
        message: `👋 ${userData.username} left the room`,
        created_at: new Date().toISOString(),
        is_system: true
      };
      setMessages(prev => [...prev, systemMessage]);
    }
  };
  
  
  const loadRoomState = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('queue')
        .eq('id', roomId)
        .single();

      if (!error && data && Array.isArray(data.queue)) {
        const sanitizeSong = (song) => {
          if (!song || typeof song !== 'object') return null;
          const { id, title, artist, thumbnail, duration, url, permanentUrl, ytId, provider, needsResolution } = song;
          const isYouTube = provider === 'youtube' || Boolean(ytId);
          const safeUrl = (!isYouTube && typeof url === 'string' && /^https?:\/\//.test(url)) ? url : undefined;
          return {
            id,
            title,
            artist,
            thumbnail: thumbnail || '/music img.png',
            duration,
            url: safeUrl,
            permanentUrl,
            ytId,
            provider,
            needsResolution: Boolean(needsResolution || (isYouTube && !safeUrl))
          };
        };

        const sanitizedQueue = data.queue.map(sanitizeSong).filter(Boolean);

        const currentQueue = queueRef.current || [];
        const isDifferent = sanitizedQueue.length !== currentQueue.length || 
          sanitizedQueue.some((song, index) => !currentQueue[index] || song.id !== currentQueue[index].id);

        if (isDifferent) {
          queueRef.current = sanitizedQueue;
          updateQueue(sanitizedQueue);
          if (window.roomSync) {
            window.roomSync.broadcastQueueUpdate(sanitizedQueue);
          }
        }
      }
    } catch (_) {
      // ignore load errors
    }
  };
  
  const loadRoomUsers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('room_users')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      
      if (data && !error) {
        // Check for users who left (not in current data but were in previous data)
        const currentUserIds = data.map(u => u.user_id);
        const previousUserIds = roomUsers.map(u => u.user_id);
        
        // Find users who left
        const usersWhoLeft = roomUsers.filter(u => 
          u.user_id !== user.id && !currentUserIds.includes(u.user_id)
        );
        
        // Show notifications for users who left
        usersWhoLeft.forEach(leftUser => {
          showNotification(`${leftUser.username} left the room`);
          
          // Add system message to chat
          const systemMessage = {
            id: `system_leave_${Date.now()}_${leftUser.user_id}`,
            user_id: 'system',
            username: 'System',
            avatar: '/music img.png',
            message: `👋 ${leftUser.username} left the room`,
            created_at: new Date().toISOString(),
            is_system: true
          };
          setMessages(prev => [...prev, systemMessage]);
        });
        
        setRoomUsers(data);
      } else {
        // Fallback to local user if no data
        setRoomUsers([{
          user_id: user.id,
          username: user.username,
          avatar: user.avatar || '/music img.png',
          room_id: roomId,
          joined_at: new Date().toISOString()
        }]);
      }
    } catch (error) {
      // console.error('Error loading room users:', error);
      // Fallback to local user
      setRoomUsers([{
        user_id: user.id,
        username: user.username,
        avatar: user.avatar || '/music img.png',
        room_id: roomId,
        joined_at: new Date().toISOString()
      }]);
    }
  };
  
  // Refresh room users every 2 seconds for faster updates
  useEffect(() => {
    const userRefreshInterval = setInterval(() => {
      loadRoomUsers();
    }, 2000);
    
    return () => clearInterval(userRefreshInterval);
  }, [roomId]);
  
  // Note: Removed user presence update to prevent PATCH errors
  // User presence is handled by the 2-second user refresh interval
  
  // Clean up user when leaving room
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Remove user from room when leaving
      if (user && roomId) {
        try {
          await supabase
            .from('room_users')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', user.id);
          // User removed from room
        } catch (error) {
          // console.error('Error removing user from room:', error);
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also clean up when component unmounts
      if (user && roomId) {
        supabase
          .from('room_users')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .then(() => {
            // User removed from room on unmount
          })
          .catch(error => {
            // console.error('Error removing user from room on unmount:', error);
          });
      }
    };
  }, [user, roomId]);
  
  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (data && !error) {
        setMessages(data);
      }
    } catch (error) {
      // console.error('Error loading messages:', error);
    }
  };
  
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    
    // Auto-scroll to bottom after sending message
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
    
    // Add message locally first for immediate display
    const localMessage = {
      id: `local_${Date.now()}`,
      room_id: roomId,
      user_id: user.id,
      username: user.username,
      avatar: user.avatar || '/music img.png',
      message: messageText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, localMessage]);
    
    // Sync with Supabase
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          username: user.username,
          avatar: user.avatar || '/music img.png',
          message: messageText
        });
      
      if (error) {
        // console.error('Error sending message:', error);
      }
    } catch (error) {
      // console.error('Error sending message:', error);
    }
  };
  
  const handlePlayPause = async () => {
    // Room play/pause clicked
    
    // Update timestamp to prevent conflicts
    lastActionTimeRef.current = Date.now();
    
    // Simple toggle - let PlaybackContext handle the actual play/pause
    if (isPlaying) {
      // Pausing
      pause();
      // Broadcast pause to other users via Socket.io
      if (window.roomSync) {
        window.roomSync.broadcastPlayPause(false);
      }
    } else {
      // Playing
      play();
      // Broadcast play to other users via Socket.io
      if (window.roomSync) {
        window.roomSync.broadcastPlayPause(true);
      }
    }
  };
  
  const handleFileUpload = async (event) => {
    if (!uploadsEnabled) {
      showNotification('Uploads are disabled on this server');
      return;
    }
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    setIsUploading(true);
    showNotification('Uploading songs...');
    
    // Process files in parallel for faster upload
    const uploadPromises = files.map(async (file) => {
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
        showNotification('File too large. Maximum size is 50MB.');
        return null;
      }
      
      if (!file.type.startsWith('audio/')) {
        showNotification('Please select audio files only.');
        return null;
      }
      
      try {
        const uploadResult = await uploadAudioToSupabase(file, roomId, user.id);
        
        // Create song immediately with placeholder duration
          const song = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Uploaded File',
          url: uploadResult.publicUrl,
            thumbnail: '/music img.png',
          duration: 0, // Will be updated in background
          file: file,
          isLocal: uploadResult.isLocal
          };
          
        // Add to queue immediately (completely non-blocking)
        const currentQueue = queueRef.current;
        const newQueue = [...currentQueue, song];
        
        // Update ref FIRST to prevent conflicts
        queueRef.current = newQueue;
        
        // Then update state
      updateQueue(newQueue);
          
        // Broadcast queue update immediately
        if (window.roomSync) {
          window.roomSync.broadcastQueueUpdate(newQueue);
        }
        
        // Load duration in background without blocking
        const audio = new Audio(uploadResult.publicUrl);
        audio.addEventListener('loadedmetadata', () => {
          const duration = audio.duration;
          const currentQueue = queueRef.current;
          const updatedQueue = currentQueue.map(s => 
            s.id === song.id ? { ...s, duration: duration } : s
          );
          updateQueue(updatedQueue);
          
          if (window.roomSync) {
            window.roomSync.broadcastQueueUpdate(updatedQueue);
          }
        });
        
        // Update room queue if Supabase is available (non-blocking)
        if (isSupabaseReal) {
          supabase
            .from('rooms')
            .update({
              queue: newQueue,
              updated_at: new Date().toISOString()
            })
            .eq('id', roomId)
            .then(() => {
              // Queue updated in Supabase
            })
            .catch(error => {
              // console.error('❌ Error saving to Supabase:', error);
            });
        }
        
        showNotification(`Added "${song.title}" to queue`);
        return song;
      } catch (uploadError) {
        // console.error('Upload error:', uploadError);
        showNotification(`Failed to upload "${file.name}"`);
        return null;
      }
    });

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    
      setIsUploading(false);
      event.target.value = '';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setIsPlaylistSearch(false);
    
    try {
      const isPlaylist = /list=/.test(searchQuery) || /youtube\.com\/playlist/.test(searchQuery);
      if (isPlaylist) {
        const { fetchYouTubePlaylist, parseYouTubePlaylistId } = await import('../utils/media-resolver');
        const listId = parseYouTubePlaylistId(searchQuery);
        const results = await fetchYouTubePlaylist(listId, 500);
        const filtered = (results || []).filter(r => r?.ytId);
        setSearchResults(filtered);
        setIsPlaylistSearch(filtered.length > 0);
        setSearchVisibleCount(50);
      } else {
        const results = await resolveUrlOrSearch(searchQuery, 'youtube', { prefetch: false });
        const filtered = (results || []).filter(r => r?.ytId);
        setSearchResults(filtered);
        setSearchVisibleCount(10);
      }
    } catch (error) {
      // console.error('Search error:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const buildYouTubeSong = (result) => {
    const ytId = result?.ytId || result?.id || '';
    const title = result?.title || 'YouTube Track';
    const artist = result?.artist || 'YouTube';
    const thumbnail = result?.thumbnail || '/music img.png';
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return {
      id,
      title,
      artist,
      thumbnail,
      ytId,
      provider: 'youtube',
      needsResolution: true
    };
  };

  const handleAddSearchResult = (result) => {
    const song = buildYouTubeSong(result);
    addToQueue(song);
    showNotification(`Added "${song.title}" to queue`);
  };

  const handlePlaySearchResult = (result) => {
    const song = buildYouTubeSong(result);
    addToQueue(song);
    playSong(song);
  };

  const addManyToQueue = (songs) => {
    if (!songs.length) return;
    const newQueue = [...(queueRef.current || []), ...songs];
    queueRef.current = newQueue;
    updateQueue(newQueue);
    if (window.roomSync) {
      window.roomSync.broadcastQueueUpdate(newQueue);
    }
  };

  const handleAddAllSearchResults = () => {
    const songs = searchResults.map(buildYouTubeSong);
    addManyToQueue(songs);
    showNotification(`Added ${songs.length} songs to queue`);
  };

  useEffect(() => {
    if (queue.length <= 50) {
      setQueueVisibleCount(queue.length || 50);
    }
  }, [queue.length]);
  
  const addToQueue = async (song) => {
    const newQueue = [...(queueRef.current || []), song];
    queueRef.current = newQueue;
    updateQueue(newQueue);

    if (window.roomSync) {
      window.roomSync.broadcastQueueUpdate(newQueue);
    }

    // Persist queue so it survives when room becomes empty
    if (isSupabaseReal) {
      supabase
        .from('rooms')
        .update({
          queue: newQueue,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .then(() => {})
        .catch(() => {});
    }
  };
  
    const playSong = async (song) => {
      lastActionTimeRef.current = Date.now();
      
      // Update refs first to prevent conflicts
      currentSongRef.current = song;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const resolvedSong = await setCurrentSong(song);
      if (resolvedSong?.url && song?.id) {
        const currentQueue = queueRef.current || [];
        const updatedQueue = currentQueue.map(item => item.id === song.id ? { ...item, url: resolvedSong.url, needsResolution: false } : item);
        queueRef.current = updatedQueue;
        updateQueue(updatedQueue);
        if (window.roomSync) {
          window.roomSync.broadcastQueueUpdate(updatedQueue);
        }
      }
      
      // Preload next song for smoother transitions
      const upcomingSong = getNextSongFromQueue(song, queueRef.current);
      if (upcomingSong) {
        preloadSong(upcomingSong);
      }
      
      // Play immediately after state update
      play();
      if (window.roomSync) {
        window.roomSync.broadcastSongChange(song);
        // Immediately align everyone to start of the new song
        window.roomSync.broadcastSeek(0);
        window.roomSync.broadcastPlayPause(true);
      }
    };

    const handleSkipNext = async () => {
    // console.log('handleSkipNext called');
    const currentQueue = queueRef.current;
    // console.log('Current queue length:', currentQueue.length);
    // console.log('Current song from state:', currentSong?.title);
    // console.log('Current song from ref:', currentSongRef.current?.title);
    
    // Use ref if state is undefined
    const activeCurrentSong = currentSong || currentSongRef.current;
    
    if (currentQueue.length <= 1) {
      if (activeCurrentSong?.id) {
        removeSongFromQueue(activeCurrentSong.id);
      }
      pause();
      setCurrentSong(null);
      if (window.roomSync) {
        window.roomSync.broadcastPlayPause(false);
      }
      return;
    }
    // console.log('Active current song:', activeCurrentSong?.title);
    
    const currentIndex = currentQueue.findIndex(song => song.id === activeCurrentSong?.id);
    // console.log('Current index:', currentIndex);
    
    if (currentIndex === -1) {
      // console.log('Current song not found in queue, playing first song');
      // If no current song, play the first one
      const firstSong = currentQueue[0];
      if (firstSong) {
        currentSongRef.current = firstSong;
        await setCurrentSong(firstSong);
        play();
        if (window.roomSync) {
          window.roomSync.broadcastSongChange(firstSong);
          window.roomSync.broadcastSeek(0);
          window.roomSync.broadcastPlayPause(true);
        }
      }
      return;
    }
    
      let nextIndex = (currentIndex + 1) % currentQueue.length;
      const nextSong = currentQueue[nextIndex];
    // console.log('Next index:', nextIndex);
    // console.log('Next song:', nextSong?.title);
    
      if (nextSong && nextSong.id !== activeCurrentSong?.id) {
        // console.log('Playing next song:', nextSong.title);
        
        // Update refs first to prevent conflicts
        currentSongRef.current = nextSong;
        lastActionTimeRef.current = Date.now();
        
        // Update state
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        const resolvedSong = await setCurrentSong(nextSong);
        if (resolvedSong?.url && nextSong?.id) {
          const currentQueueForUpdate = queueRef.current || [];
          const updatedQueue = currentQueueForUpdate.map(item => item.id === nextSong.id ? { ...item, url: resolvedSong.url, needsResolution: false } : item);
          queueRef.current = updatedQueue;
          updateQueue(updatedQueue);
          if (window.roomSync) {
            window.roomSync.broadcastQueueUpdate(updatedQueue);
          }
        }
      
      // Stop current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
        // Play next song immediately
        play();

        // Preload upcoming song
        const upcomingSong = getNextSongFromQueue(nextSong, queueRef.current);
        if (upcomingSong) {
          preloadSong(upcomingSong);
        }
      
      // Broadcast changes
        if (window.roomSync) {
          window.roomSync.broadcastSongChange(nextSong);
          window.roomSync.broadcastSeek(0);
          window.roomSync.broadcastPlayPause(true);
        }

        // Remove the previous song from queue so it doesn't repeat
        if (activeCurrentSong?.id) {
          removeSongFromQueue(activeCurrentSong.id);
        }
      } else {
        // console.log('No valid next song found');
      }
    };

  const handleSkipPrevious = async () => {
    if (queue.length === 0) return;
    
    const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
    const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    const prevSong = queue[prevIndex];
    
    if (prevSong) {
      await playSong(prevSong);
    }
  };

  const handleQueueNext = async (song) => {
    // Queue next clicked
    
    // Find current song index
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    const songIndex = queue.findIndex(s => s.id === song.id);
    
    if (currentIndex === -1 || songIndex === -1) return;
    
    // Move song to next position after current song
    const newQueue = [...queue];
    const [movedSong] = newQueue.splice(songIndex, 1);
    const insertIndex = currentIndex + 1;
    newQueue.splice(insertIndex, 0, movedSong);
    
    // Update queue
    updateQueue(newQueue);
    queueRef.current = newQueue;
    
    // Update room queue if Supabase is available
    if (isSupabaseReal) {
      supabase
        .from('rooms')
        .update({
          queue: newQueue,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .then(() => {
          // Queue reordered in Supabase
        })
        .catch(error => {
          // console.error('❌ Error updating queue:', error);
        });
    }
    
    // Broadcast queue update
    if (window.roomSync) {
      window.roomSync.broadcastQueueUpdate(newQueue);
    }
    
    showNotification(`"${song.title}" moved to play next`);
  };

  const handleDeleteSong = async (song) => {
    // Delete song clicked
    
    // Remove song from queue
    const newQueue = queue.filter(s => s.id !== song.id);
    updateQueue(newQueue);
    queueRef.current = newQueue;
    
    // If we're deleting the current song, stop playback
    if (currentSong?.id === song.id) {
      pause();
      setCurrentSong(null);
    }
    
    // Update room queue if Supabase is available
    if (isSupabaseReal) {
      supabase
        .from('rooms')
        .update({
          queue: newQueue,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .then(() => {
          // Song deleted from Supabase
        })
        .catch(error => {
          // console.error('❌ Error updating queue:', error);
        });
    }
    
    // Broadcast queue update
    if (window.roomSync) {
      window.roomSync.broadcastQueueUpdate(newQueue);
    }
    
    showNotification(`"${song.title}" removed from queue`);
  };
  
  const showNotification = (message) => {
    // Simple notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1db954;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1000;
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(notification);
    
    // Play sound for join/leave notifications
    if (message.includes('joined') || message.includes('left')) {
      try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (e) {
        // console.log('Audio not available');
      }
    }
    
       setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  };
  
  if (connectionStatus === 'connecting') {
    return (
      <div className="room-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to room...</p>
      </div>
    );
  }
  
  if (connectionStatus === 'error') {
    return (
      <div className="room-error">
        <h2>Connection Error</h2>
        <p>Failed to connect to room. Please try again.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="room-container room-page">
      <div className="room-header">
        <h1>🎵 Room <span className="room-code">{roomId}</span></h1>
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus}`}></span>
          {connectionStatus === 'connected' && 'Connected'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'error' && 'Connection Error'}
          {connectionStatus === 'offline' && 'Offline Mode'}
          {connectionStatus === 'error' && (
            <button 
              className="retry-btn"
              onClick={() => {
                retryCountRef.current = 0;
                lastConnectionTimeRef.current = 0;
                isConnectingRef.current = false;
                setRealtimeDisabled(false);
                if (retryTimeoutRef.current) {
                  clearTimeout(retryTimeoutRef.current);
                  retryTimeoutRef.current = null;
                }
                setupRealtimeChannel();
              }}
              style={{
                marginLeft: '10px',
                padding: '4px 8px',
                fontSize: '12px',
                background: '#1db954',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          )}
                </div>
          </div>

      <div className="room-content">
        <div className="room-main">
          <div className="queue-section">
            <div className="section-header">
              <h2>🎵 Queue ({queue.length})</h2>
              <div className="queue-controls">
                <button
                  className="btn-secondary youtube-search-btn"
                  onClick={() => setShowSearchSection(prev => !prev)}
                >
                  {showSearchSection ? 'Hide YouTube Search' : 'YouTube Search'}
                </button>
                {uploadsEnabled && (
                  <label className="btn-upload upload-btn">
                    Upload MP3
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {showSearchSection && (
              <div className="search-section">
                <div className="search-bar">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search YouTube songs or paste a YouTube link"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                  {isPlaylistSearch && (
                    <button onClick={handleAddAllSearchResults}>
                      Add All
                    </button>
                  )}
                </div>

                {searchError && (
                  <div className="search-error">{searchError}</div>
                )}

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.slice(0, searchVisibleCount).map((song) => (
                      <div key={`${song.ytId}_${song.title}`} className="search-result">
                        <img src={song.thumbnail || '/music img.png'} alt={song.title} />
                        <div className="song-info">
                          <h4>{song.title}</h4>
                          <p>{song.artist || 'YouTube'}</p>
                        </div>
                        <button onClick={() => handleAddSearchResult(song)}>Add</button>
                        <button onClick={() => handlePlaySearchResult(song)}>Play</button>
                      </div>
                    ))}
                    {searchResults.length > searchVisibleCount && (
                      <button
                        className="btn-secondary load-more-btn"
                        onClick={() => setSearchVisibleCount(prev => prev + 50)}
                      >
                        Load More ({searchVisibleCount}/{searchResults.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

        <div className="queue-list">
            {queue.length === 0 ? (
                <div className="empty-queue">
                  <p>No songs in queue. Add some music!</p>
                </div>
              ) : (
                queue.slice(0, queueVisibleCount).map((song, index) => (
                  <div key={song.id} className={`queue-item ${currentSong?.id === song.id ? 'current' : ''}`}>
                    <div className="song-info">
                      <img src={song.thumbnail} alt={song.title} />
                      <div>
                        <h4>{song.title}</h4>
                        <p>{song.artist}</p>
                </div>
                    </div>
                    <div className="song-controls">
                      <button 
                        onClick={() => playSong(song)}
                        className="play-btn"
                        disabled={isUploading}
                        title="Play this song"
                      >
                        {currentSong?.id === song.id && isPlaying ? '⏸️' : '▶️'}
                      </button>
                      
                      <button 
                        onClick={() => handleQueueNext(song)}
                        className="queue-next-btn"
                        disabled={isUploading}
                        title="Play next"
                      >
                        ⬆️
                      </button>
                      
                      <button 
                        onClick={() => handleDeleteSong(song)}
                        className="delete-btn"
                        disabled={isUploading}
                        title="Delete song"
                      >
                        🗑️
                      </button>
                    </div>
              </div>
                ))
            )}
            {queue.length > queueVisibleCount && (
              <button
                className="btn-secondary load-more-btn"
                onClick={() => setQueueVisibleCount(prev => prev + 50)}
              >
                Show More ({queueVisibleCount}/{queue.length})
              </button>
            )}
            </div>
        </div>
      </div>

        <div className="room-sidebar">
          
          <div className="users-section">
            <h3>👥 Users ({roomUsers.length})</h3>
            <div className="users-list scrollable">
              {roomUsers.map((user) => (
                <div key={user.user_id} className="user-item">
                  <img src={user.avatar} alt={user.username} />
                  <span>{user.username}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="chat-section">
            <h3>💬 Chat</h3>
            <div className="chat-messages">
              {messages.map((message) => (
                <div key={message.id} className="chat-message" data-system={message.is_system ? "true" : "false"}>
                  {!message.is_system && <img src={message.avatar} alt={message.username} />}
                  <div>
                    <strong>{message.username}</strong>
                    <p>{message.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
        <div className="chat-input">
          <input
            type="text"
                placeholder="Type a message..."
            value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
              <button onClick={sendMessage}>Send</button>
            </div>
        </div>
      </div>
      </div>
    </div>
  );
}
