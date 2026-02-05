import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSpotify } from './SpotifyContext';
import queueManager from '../utils/queueManager';

export const PlaybackContext = createContext();

export const PlaybackProvider = ({ children }) => {
  // Core state
  const [currentSong, setCurrentSongState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  
  // Refs
  const audioRef = useRef(null);
  const preloadAudioRef = useRef(null);
  const skipNextCallbackRef = useRef(null);
  const syncCallbackRef = useRef(null);
  const loadedTracksRef = useRef(new Map()); // Track loaded audio elements
  const pendingPlayRef = useRef(false);
  const pendingSeekRef = useRef(null);
  
  // Spotify context
  const { 
    isSpotifyReady, 
    playSpotifyTrack, 
    pauseSpotify, 
    resumeSpotify, 
    isSpotifyPlaying,
    spotifyCurrentTrack,
    spotifyPosition,
    spotifyDuration
  } = useSpotify();

  // Initialize audio element - optimized for low-end devices
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'auto';
      audioRef.current.volume = 1.0;
      
      // Detect low-end device
      const hardwareThreads = navigator.hardwareConcurrency || 8;
      const net = navigator.connection;
      const isLowEndDevice = hardwareThreads <= 4 || (net && (net.saveData || /(^|slow-)?2g/.test(net.effectiveType || '')));
      
      if (isLowEndDevice) {
        // Throttle timeupdate for low-end devices
        let lastTimeUpdate = 0;
        let lastSyncTime = 0;
        audioRef.current.addEventListener('timeupdate', () => {
          const now = Date.now();
          if (now - lastTimeUpdate < 200) return; // 5fps max for low-end
          lastTimeUpdate = now;
          
          // Prevent sync loops on low-end devices
          if (now - lastSyncTime < 1000) return; // Max 1 sync per second
          lastSyncTime = now;
        });
        
        // Reduce audio quality for low-end devices
        audioRef.current.preload = 'none';
        audioRef.current.crossOrigin = 'anonymous';
      }
    }
    if (!preloadAudioRef.current) {
      preloadAudioRef.current = new Audio();
      preloadAudioRef.current.crossOrigin = 'anonymous';
      preloadAudioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      // Audio element: play event fired
      setIsPlaying(true);
      pendingPlayRef.current = false;
    };
    const handlePause = () => {
      // Audio element: pause event fired
      // Only set playing to false if we're not in the middle of loading a new song
      if (!isLoading) {
        setIsPlaying(false);
      }
    };
    const handleEnded = () => {
      // Audio element: ended event fired
      setIsPlaying(false);
      if (skipNextCallbackRef.current) {
        try { skipNextCallbackRef.current(); } catch {}
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Play function with better error handling
  const play = useCallback(() => {
    // PlaybackContext: play() called
    
    if (!audioRef.current) {
      // No audio element, cannot play
      return;
    }
    
    // Audio element exists
    
    // Set playing state immediately
    setIsPlaying(true);
    queueManager.setIsPlaying(true);
    pendingPlayRef.current = true;
    
    // Force play with retry mechanism
    const attemptPlay = () => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch((error) => {
          // If play fails, try again after a short delay
          setTimeout(() => {
            if (audioRef.current && audioRef.current.paused) {
              audioRef.current.play().catch(() => {
                // Final attempt failed, but don't change state
              });
            }
          }, 100);
        });
      }
    };
    
    // Try to play immediately
    attemptPlay();
  }, [currentSong]);

  // Pause function
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setIsPlaying(false);
    queueManager.setIsPlaying(false);
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    // YouTube only mode - no Spotify handling
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Simplified track loading - no complex lazy loading
  const loadTrackOnDemand = useCallback(async (song) => {
    // Just return the song as-is, no complex loading
    return song;
  }, []);

  const preloadSong = useCallback(async (song) => {
    if (!song) return;
    try {
      if (song.ytId) {
        const { warmYouTubeAudio, getYouTubeAudioUrl } = await import('../utils/media-resolver');
        await warmYouTubeAudio(song.ytId);
        // If warmup is unavailable, fallback to prebuffering via proxy stream
        if (preloadAudioRef.current) {
          const streamUrl = await getYouTubeAudioUrl(song.ytId);
          if (streamUrl && preloadAudioRef.current.src !== streamUrl) {
            preloadAudioRef.current.src = streamUrl;
            preloadAudioRef.current.load();
          }
        }
        return;
      }

      if (!preloadAudioRef.current) return;
      let url = song.url;
      if (url && preloadAudioRef.current.src !== url) {
        preloadAudioRef.current.src = url;
        preloadAudioRef.current.load();
      }
    } catch {}
  }, []);

  // Simplified cleanup - no complex track management
  const cleanupOldTracks = useCallback(() => {
    // No complex cleanup needed
  }, []);

  // Set current song
  const setCurrentSong = useCallback(async (song) => {
    if (!song) {
      setCurrentSongState(null);
      queueManager.setCurrentSong(null);
      if (audioRef.current) {
        audioRef.current.src = '';
      }
      return null;
    }

    // Clean up old tracks before loading new one
    cleanupOldTracks();

    setCurrentSongState(song);
    queueManager.setCurrentSong(song);
    setIsLoading(true);

    // Load track on demand if not already loaded
    const loadedTrack = await loadTrackOnDemand(song);
    if (loadedTrack && loadedTrack.error) {
      // console.error('Track failed to load:', song.title);
      setIsLoading(false);
      return null;
    }

    // Handle items that need URL resolution (YouTube)
    const hasVideoIdUrl = typeof song.url === 'string' && song.url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(song.url);
    const shouldResolve = Boolean(song?.ytId) && (song.needsResolution || !song.url || hasVideoIdUrl);
    if (shouldResolve) {
      // console.log('🔄 Resolving URL for song:', song.title);
      try {
        const { getYouTubeAudioUrl } = await import('../utils/media-resolver');
        const url = await getYouTubeAudioUrl(song.ytId);
        if (url) {
          // console.log('✅ URL resolved:', url);
          // Update the song with the resolved URL
          const updatedSong = { ...song, url, needsResolution: false };
          setCurrentSongState(updatedSong);
          queueManager.setCurrentSong(updatedSong);
          // Continue with normal playback
          song = updatedSong;
        }
      } catch (error) {
        // console.error('❌ Failed to resolve URL:', error);
        // Fall through to ID-based resolution below
      }
    }

    // YouTube only mode - no Spotify playback

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      pendingSeekRef.current = null;
      // Handle uploaded files properly
      if (song.file instanceof File) {
        try { 
          const blobUrl = URL.createObjectURL(song.file);
          audioRef.current.src = blobUrl; 
          // console.log('🎵 Using uploaded file for playback:', song.title);
        } catch (e) { 
          // console.error('❌ Error creating object URL:', e);
          // Fallback to song URL if available
          if (song.url && song.url !== 'blob:') {
            audioRef.current.src = song.url;
          } else {
            // console.error('❌ No valid audio source available');
            setIsLoading(false);
            return;
          }
        }
      } else if (song.permanentUrl) {
        // Use permanent URL from Supabase first
        audioRef.current.src = song.permanentUrl;
        // console.log('🎵 Using permanent URL for playback:', song.title);
      } else if (song.url && typeof song.url === 'string' && song.url.startsWith('blob:')) {
        // Use existing blob URL
        audioRef.current.src = song.url;
        // console.log('🎵 Using blob URL for playback:', song.title);
      } else if (song.url && song.url !== 'blob:') {
        // console.log('🎵 Using direct URL for playback:', song.title);
        audioRef.current.src = song.url;
      } else {
        // Handle YouTube URLs and video IDs
        let audioUrl = song.url || song.src || '';
        if (!audioUrl && song.ytId) {
          audioUrl = song.ytId;
        }
        
        // Check if it's a YouTube video ID (11 characters, alphanumeric)
        if (audioUrl && audioUrl.length === 11 && /^[a-zA-Z0-9_-]+$/.test(audioUrl)) {
          // console.log('🎵 YouTube video ID detected:', audioUrl);
          try {
            const { getYouTubeAudioUrl } = await import('../utils/media-resolver');
            const proxiedUrl = await getYouTubeAudioUrl(audioUrl);
            if (proxiedUrl && audioRef.current) {
              audioRef.current.src = proxiedUrl;
              audioRef.current.load();
              return;
            }
          } catch (error) {
            // console.warn('⚠️ Failed to get YouTube stream:', error);
          }

          // Fallback to placeholder if stream fails
          if (audioRef.current) {
            audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
            audioRef.current.load();
            // console.log('🎵 Using placeholder audio for YouTube video ID');
          }
          return;
        }
        
        // Check if it's a YouTube watch URL
        if (audioUrl.includes('youtube.com/watch?v=')) {
          const videoId = audioUrl.split('v=')[1]?.split('&')[0];
          if (videoId) {
            // console.log('🎵 YouTube URL detected, using placeholder for:', videoId);
            // Use placeholder to prevent crashes
            if (audioRef.current) {
              audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
              audioRef.current.load();
            }
            return;
          }
        }
        
        audioRef.current.src = audioUrl;
      }
      audioRef.current.oncanplay = () => {
        setIsLoading(false);
        if (pendingPlayRef.current) {
          audioRef.current.play().catch(() => {});
        }
        // console.log('🎵 Audio can play:', song.title);
      };

      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current && pendingSeekRef.current !== null) {
          audioRef.current.currentTime = pendingSeekRef.current;
          pendingSeekRef.current = null;
        }
      };

      audioRef.current.load();

    audioRef.current.onerror = (e) => {
      // console.error('Error loading audio:', song, e);
      setIsLoading(false);
      
      // Try to fix blob URL issues
      if (song.url && typeof song.url === 'string' && song.url.startsWith('blob:')) {
          // console.log('🔄 Attempting to fix blob URL...');
          try {
            // For uploaded files, try to recreate the blob URL
            if (song.file && song.file.size > 0) {
              // Validate file before creating blob URL
              if (song.file instanceof File || song.file instanceof Blob) {
                const newBlobUrl = URL.createObjectURL(song.file);
                // console.log('🔄 Created new blob URL:', newBlobUrl);
                audioRef.current.src = newBlobUrl;
                audioRef.current.load();
                return;
              }
            }
          } catch (blobError) {
            // console.error('Failed to recreate blob URL:', blobError);
          }
        }
        
      // If it's a regular URL, try cache busting
      if (song.url && typeof song.url === 'string' && !song.url.startsWith('blob:')) {
          // console.log('🔄 Attempting cache busting...');
          try {
            const urlWithCacheBust = `${song.url}?t=${Date.now()}`;
            audioRef.current.src = urlWithCacheBust;
            audioRef.current.load();
            return;
          } catch (cacheError) {
            // console.error('Failed cache busting:', cacheError);
          }
        }
        
      // If it's a Supabase URL, try with different headers
      if (song.url && typeof song.url === 'string' && song.url.includes('supabase.co')) {
          // console.log('🔄 Trying Supabase URL with different approach...');
          try {
            // Try loading with fetch first to check if URL is accessible
            fetch(song.url, { method: 'HEAD' })
              .then(response => {
                if (response.ok) {
                  // console.log('✅ Supabase URL is accessible, retrying audio load');
                  audioRef.current.src = song.url;
                  audioRef.current.load();
                } else {
                  // console.error('❌ Supabase URL not accessible:', response.status);
                }
              })
              .catch(fetchError => {
                // console.error('❌ Failed to check Supabase URL:', fetchError);
              });
            return;
          } catch (error) {
            // console.error('Failed Supabase URL check:', error);
          }
        }
        
        // If all else fails, try to use the permanent URL from Supabase
        if (song.permanentUrl) {
          // console.log('🔄 Trying permanent URL:', song.permanentUrl);
          audioRef.current.src = song.permanentUrl;
          audioRef.current.load();
          return;
        }
        
      // Last resort: try the original URL
      if (song.url && typeof song.url === 'string' && song.url !== audioRef.current.src) {
          // console.log('🔄 Trying original URL:', song.url);
          audioRef.current.src = song.url;
          audioRef.current.load();
          return;
        }
        
        // console.log('❌ Audio loading failed, no more retries');
      };

      audioRef.current.onloadstart = () => {
        // console.log('🎵 Audio loading started for:', song.title);
      };

      audioRef.current.onloadeddata = () => {
        // console.log('🎵 Audio data loaded for:', song.title);
      };
    }
    return song || null;
  }, [loadTrackOnDemand, cleanupOldTracks]);

  // Update queue
  const updateQueue = useCallback((newQueue) => {
    setQueue(newQueue);
    queueManager.updateQueue(newQueue);
  }, []);

  const setPendingSeek = useCallback((time) => {
    if (typeof time !== 'number' || Number.isNaN(time)) return;
    pendingSeekRef.current = Math.max(0, time);
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = pendingSeekRef.current;
      } catch {}
    }
  }, []);

  // Add to queue
  const addToQueue = useCallback((song) => {
    // Strip local blob URLs so remote peers don't try to load them
    const sanitized = { ...song };
    if (typeof sanitized.url === 'string' && sanitized.url.startsWith('blob:')) {
      delete sanitized.url;
    }
    setQueue(prev => [...prev, sanitized]);
  }, []);

  // Remove from queue
  const removeFromQueue = useCallback((index) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Set skip next callback
  const setSkipNextCallback = useCallback((callback) => {
    skipNextCallbackRef.current = callback;
  }, []);

  // Skip next
  const skipNext = useCallback(() => {
    if (skipNextCallbackRef.current) {
      skipNextCallbackRef.current();
    }
  }, []);

  // Skip previous
  const skipPrevious = useCallback(() => {
    // Skip previous implementation
  }, []);

  // Toggle shuffle
  const setShuffleModeState = useCallback((value) => {
    setShuffleMode(!!value);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode(prev => !prev);
  }, []);

  // Toggle repeat
  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // Set volume
  const setVolume = useCallback((volume) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
      
      // Sync with other users
      if (syncCallbackRef.current) {
        syncCallbackRef.current('volume', { volume });
      }
    }
  }, []);

  // Get current time
  const getCurrentTime = useCallback(() => {
    return audioRef.current ? audioRef.current.currentTime : 0;
  }, []);

  // Set current time
  const setCurrentTime = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  // Seek function
  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      
      // Sync with other users
      if (syncCallbackRef.current) {
        syncCallbackRef.current('seek', { pos: time });
      }
    }
  }, []);

  // Get duration
  const getDuration = useCallback(() => {
    return audioRef.current ? audioRef.current.duration : 0;
  }, []);

  // Get volume
  const getVolume = useCallback(() => {
    return audioRef.current ? audioRef.current.volume : 1;
  }, []);

  // Set sync callback
  const setSyncCallback = useCallback((callback) => {
    syncCallbackRef.current = callback;
  }, []);

  // Reset queue and current song (for room switching)
  const resetPlayback = useCallback(() => {
    setCurrentSongState(null);
    setQueue([]);
    setIsPlaying(false);
    setIsLoading(false);
    queueManager.setCurrentSong(null);
    queueManager.updateQueue([]);
    queueManager.setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Context value
  const value = {
    // State
    currentSong,
    isPlaying,
    isLoading,
    queue,
    shuffleMode,
    repeatMode,
    
    // Refs
    audioRef,
    
    // Actions
    play,
    pause,
    setCurrentSong,
    updateQueue,
    addToQueue,
    removeFromQueue,
    setSkipNextCallback,
    skipNext,
    skipPrevious,
    setSyncCallback,
    toggleShuffle,
    setShuffleModeState,
    preloadSong,
    toggleRepeat,
    togglePlayPause,
    setVolume,
    getCurrentTime,
    setCurrentTime,
    seek,
    setPendingSeek,
    getDuration,
    getVolume,
    resetPlayback
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};
