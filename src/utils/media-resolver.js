// Minimal media resolver for YouTube (via Piped) and Spotify links

const PIPED_BASE = import.meta.env.VITE_PIPED_BASE || 'https://piped.video';
const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';
const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
const API_BASE = (!isDev && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_SERVER_URL)
  ? String(import.meta.env.VITE_SOCKET_SERVER_URL || '').replace(/\/$/, '')
  : '';

const withApiBase = (path) => API_BASE ? `${API_BASE}${path}` : path;

function pickBestAudioStream(audioStreams = []) {
  if (!Array.isArray(audioStreams) || audioStreams.length === 0) return null;
  const sorted = [...audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return sorted[0] || audioStreams[0];
}

export function parseYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/');
    const idx = parts.indexOf('shorts');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {}
  return null;
}

export function parseYouTubePlaylistId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('list') || null;
  } catch {}
  return null;
}

export async function searchYouTube(query, limit = 10) {
  // console.log('🎵 searchYouTube called with:', { query, limit });
  
  // Prefer backend proxy to avoid CORS/rate issues
  try {
    const url = withApiBase(`/api/youtube/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    // console.log('🔗 YouTube search URL:', url);
    
    const res = await fetch(url);
    // console.log('📡 YouTube search response status:', res.status);
    
    if (res.ok) {
      const data = await res.json();
      // console.log('📊 YouTube search raw data:', data);
      
      const items = data?.items || [];
      // console.log('✅ YouTube search results:', items);
      return items;
    } else {
      // console.log('❌ YouTube search failed with status:', res.status);
    }
  } catch (e) {
    // console.error('❌ YouTube search error:', e);
  }
  // Client-side fallback
  if (YT_API_KEY) {
    // console.log('🔄 Trying YouTube API fallback...');
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;
      // console.log('🔗 YouTube API URL:', url);
      
      const res = await fetch(url);
      // console.log('📡 YouTube API response status:', res.status);
      
      if (!res.ok) {
        // console.log('❌ YouTube API failed with status:', res.status);
        throw new Error('YouTube API search failed');
      }
      
      const data = await res.json();
      // console.log('📊 YouTube API raw data:', data);
      
      const items = data?.items || [];
      const results = items.map(it => ({
        ytId: it?.id?.videoId,
        title: it?.snippet?.title || 'Unknown',
        artist: it?.snippet?.channelTitle || 'YouTube',
        thumbnail: it?.snippet?.thumbnails?.medium?.url || it?.snippet?.thumbnails?.default?.url || ''
      }));
      
      // console.log('✅ YouTube API results:', results);
      return results;
    } catch (e) {
      // console.error('❌ YouTube API error:', e);
    }
  } else {
    // console.log('❌ No YouTube API key available');
  }
  // console.log('🔄 Trying Piped fallback...');
  const url = `${PIPED_BASE}/api/v1/search?q=${encodeURIComponent(query)}&region=US`;
  // console.log('🔗 Piped URL:', url);
  
  const res = await fetch(url);
  // console.log('📡 Piped response status:', res.status);
  
  if (!res.ok) {
    // console.log('❌ Piped failed with status:', res.status);
    throw new Error('YouTube search failed');
  }
  
  const data = await res.json();
  // console.log('📊 Piped raw data:', data);
  
  const items = Array.isArray(data) ? data : data?.items || [];
  // console.log('📋 Piped items count:', items.length);
  
  const results = items
    .filter(v => v?.url || v?.id || v?.videoId)
    .slice(0, limit)
    .map(v => {
      const videoId = v?.id || v?.videoId || v?.shortsId || (v?.url ? v.url.replace('/watch?v=', '').split('&')[0] : '');
      return {
        ytId: videoId,
        title: v?.title || 'Unknown',
        artist: v?.uploader || v?.author || 'YouTube',
        thumbnail: v?.thumbnail || v?.thumbnailUrl || v?.thumbnailSrc || '',
      };
    });
  
  // console.log('✅ Piped results:', results);
  return results;
}

export async function getYouTubeAudioUrl(videoId) {
  // console.log('🎵 getYouTubeAudioUrl called for videoId:', videoId);
  if (!videoId) return null;
  return withApiBase(`/api/youtube/stream/${encodeURIComponent(videoId)}`);
}

export async function warmYouTubeAudio(videoId) {
  if (!videoId) return;
  try {
    await fetch(withApiBase(`/api/youtube/stream/${encodeURIComponent(videoId)}?warm=1`));
  } catch {
    // Silence warmup errors
  }
}

export async function fetchYouTubePlaylist(playlistId, limit = 300) {
  try {
    const res = await fetch(withApiBase(`/api/youtube/playlist?list=${encodeURIComponent(playlistId)}&limit=${limit}`));
    if (res.ok) {
      const data = await res.json();
      const items = data?.items || [];
      return items.map(v => ({
        ytId: v?.ytId,
        title: v?.title || 'Unknown',
        artist: v?.artist || 'YouTube',
        thumbnail: v?.thumbnail || '',
      }));
    }
  } catch {}

  // Fallback to Piped if server is unavailable
  const res = await fetch(`${PIPED_BASE}/api/v1/playlists/${playlistId}`);
  if (!res.ok) throw new Error('Playlist fetch failed');
  const data = await res.json();
  const videos = data?.videos || data?.relatedStreams || [];
  return videos.slice(0, limit).map(v => ({
    ytId: v?.url?.replace('/watch?v=', '') || v?.id || v?.videoId,
    title: v?.title || 'Unknown',
    artist: v?.uploader || 'YouTube',
    thumbnail: v?.thumbnail || '',
  }));
}

export function parseSpotifyUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const type = parts[0];
    const id = parts[1];
    if (!type || !id) return null;
    return { type, id };
  } catch {}
  return null;
}

export async function resolveSpotifyTrackToYouTube(spotifyUrl) {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
    if (!res.ok) throw new Error('Spotify oEmbed failed');
    const data = await res.json();
    const rawTitle = data?.title || '';
    const title = rawTitle.replace(/\s*[-|]\s*song\s*by.*$/i, '').trim();
    const author = data?.author_name || '';
    const q = [title, author].filter(Boolean).join(' - ');
    const yt = await searchYouTube(q, 1);
    if (yt?.length) {
      const url = await getYouTubeAudioUrl(yt[0].ytId);
      return { title: yt[0].title, artist: yt[0].artist, thumbnail: yt[0].thumbnail, url };
    }
  } catch {}
  return null;
}

// Spotify via backend proxy (requires server .env)
export async function spotifySearch(query, type = 'track') {
  // console.log('🎧 spotifySearch called with:', { query, type });
  
  const url = `/api/spotify/search?type=${encodeURIComponent(type)}&query=${encodeURIComponent(query)}`;
  // console.log('🔗 Spotify search URL:', url);
  
  const res = await fetch(url);
  // console.log('📡 Spotify search response status:', res.status);
  
  if (!res.ok) {
    // console.error('❌ Spotify search failed with status:', res.status);
    throw new Error('Spotify search failed');
  }
  
  const data = await res.json();
  // console.log('📊 Spotify search raw data:', data);
  
  return data;
}

// Format Spotify search results for Premium playback
export function formatSpotifyResults(spotifyData, usePremium = true) {
  if (!spotifyData?.tracks?.items) return [];
  
  return spotifyData.tracks.items.map(track => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    thumbnail: track.album.images[0]?.url || '',
    // For Premium users, use Spotify URI for direct playback
    spotifyUri: usePremium ? track.uri : null,
    // Fallback to YouTube for non-Premium users
    url: usePremium ? null : `spotify:track:${track.id}`,
    provider: 'spotify',
    duration: track.duration_ms,
    album: track.album.name,
    external_urls: track.external_urls
  }));
}

export async function searchSpotify(query, limit = 10) {
  // console.log('🎧 searchSpotify called with:', { query, limit });
  
  try {
    const data = await spotifySearch(query, 'track');
    // console.log('📊 Spotify API response:', data);
    
    const tracks = data.tracks?.items || [];
    // console.log('📋 Spotify tracks count:', tracks.length);
    
    const results = tracks.slice(0, limit).map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists?.[0]?.name || 'Unknown Artist',
      thumbnail: track.album?.images?.[0]?.url || '',
      provider: 'spotify',
      spotifyId: track.id
    }));
    
    // console.log('✅ Spotify search results:', results);
    return results;
  } catch (e) {
    // console.error('❌ Spotify search error:', e);
    throw e;
  }
}

export async function spotifyTrack(id) {
  const res = await fetch(`/api/spotify/track/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Spotify track failed');
  return await res.json();
}

export async function spotifyPlaylist(id, limit = 50) {
  const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(id)}?limit=${limit}`);
  if (!res.ok) throw new Error('Spotify playlist failed');
  return await res.json();
}

export async function resolveUrlOrSearch(input, source = 'youtube', options = {}) {
  // console.log('🔍 resolveUrlOrSearch called with:', { input, source, options });
  const prefetch = Boolean(options.prefetch);
  // URL detection
  try {
    const u = new URL(input);
    // YouTube video
    const ytId = parseYouTubeId(input);
    if (ytId) {
      if (prefetch) {
        const url = await getYouTubeAudioUrl(ytId);
        return [{ title: 'YouTube Video', artist: 'YouTube', thumbnail: '', url, ytId, provider: 'youtube' }];
      }
      return [{ title: 'YouTube Video', artist: 'YouTube', thumbnail: '', url: null, ytId, provider: 'youtube' }];
    }
    // YouTube playlist
    const plId = parseYouTubePlaylistId(input);
    if (plId) {
      const vids = await fetchYouTubePlaylist(plId, 10);
      if (prefetch) {
        const withUrls = [];
        for (const v of vids) {
          try {
            const url = await getYouTubeAudioUrl(v.ytId);
            withUrls.push({ title: v.title, artist: v.artist, thumbnail: v.thumbnail, url, ytId: v.ytId, provider: 'youtube' });
          } catch {}
        }
        return withUrls;
      }
      return vids.map(v => ({ title: v.title, artist: v.artist, thumbnail: v.thumbnail, url: null, ytId: v.ytId, provider: 'youtube' }));
    }
    // Spotify track
    const sp = parseSpotifyUrl(input);
    if (sp?.type === 'track') {
      try {
        const t = await spotifyTrack(sp.id);
        const q = `${t?.name || ''} - ${(t?.artists||[]).map(a=>a.name).join(', ')}`.trim();
        if (prefetch) {
          const yt = await searchYouTube(q, 1);
          if (yt?.length) {
            const url = await getYouTubeAudioUrl(yt[0].ytId);
            return [{ title: t?.name || yt[0].title, artist: (t?.artists||[]).map(a=>a.name).join(', ') || yt[0].artist, thumbnail: t?.album?.images?.[0]?.url || yt[0].thumbnail, url, ytId: yt[0].ytId, provider: 'youtube' }];
          }
        }
        return [{ title: t?.name || 'Spotify Track', artist: (t?.artists||[]).map(a=>a.name).join(', '), thumbnail: t?.album?.images?.[0]?.url || '', url: null, spotifyId: sp.id, provider: 'spotify' }];
      } catch {
        if (prefetch) {
          const resolved = await resolveSpotifyTrackToYouTube(input);
          return resolved ? [resolved] : [];
        }
        return [{ title: 'Spotify Track', artist: '', thumbnail: '', url: null, spotifyId: sp.id, provider: 'spotify' }];
      }
    }
    // Spotify playlist
    if (sp?.type === 'playlist') {
      try {
        const pl = await spotifyPlaylist(sp.id, 50);
        const items = (pl?.items || []).map(it => it?.track).filter(Boolean);
        if (prefetch) {
          const out = [];
          for (const t of items) {
            const q = `${t?.name || ''} - ${(t?.artists||[]).map(a=>a.name).join(', ')}`.trim();
            try {
              const yt = await searchYouTube(q, 1);
              if (yt?.length) {
                const url = await getYouTubeAudioUrl(yt[0].ytId);
                out.push({ title: t?.name || yt[0].title, artist: (t?.artists||[]).map(a=>a.name).join(', ') || yt[0].artist, thumbnail: t?.album?.images?.[0]?.url || yt[0].thumbnail, url, ytId: yt[0].ytId, provider: 'youtube' });
              }
            } catch {}
          }
          return out;
        }
        return items.map(t => ({ title: t?.name || 'Spotify Track', artist: (t?.artists||[]).map(a=>a.name).join(', '), thumbnail: t?.album?.images?.[0]?.url || '', url: null, spotifyId: t?.id, provider: 'spotify' }));
      } catch {
        return [];
      }
    }
  } catch {}

  // Plain text search
  if (source === 'youtube') {
    const list = await searchYouTube(input, 10);
    if (!prefetch) {
      return list.map(v => ({
        title: v.title,
        artist: v.artist,
        thumbnail: v.thumbnail,
        ytId: v.ytId,
        provider: 'youtube',
        url: null
      }));
    }
    const out = [];
    for (const v of list) {
      try {
        const url = await getYouTubeAudioUrl(v.ytId);
        out.push({ title: v.title, artist: v.artist, thumbnail: v.thumbnail, ytId: v.ytId, provider: 'youtube', url });
      } catch {}
    }
    return out;
  }
  if (source === 'spotify') {
    try {
      const res = await spotifySearch(input, 'track');
      const tracks = res?.tracks?.items || [];
      const out = [];
      for (const t of tracks) {
        const title = t?.name || '';
        const artist = (t?.artists||[]).map(a=>a.name).join(', ');
        const thumb = t?.album?.images?.[0]?.url || '';
        const q = `${title} - ${artist}`.trim();
        try {
          const yt = await searchYouTube(q, 1);
          if (yt?.length) {
            const url = await getYouTubeAudioUrl(yt[0].ytId);
            out.push({ title, artist, thumbnail: thumb || yt[0].thumbnail, url });
          }
        } catch {}
      }
      return out;
    } catch {
      // Fallback: direct YouTube search
      const list = await searchYouTube(input, 10);
      const out = [];
      for (const v of list) {
        try {
          const url = await getYouTubeAudioUrl(v.ytId);
          out.push({ title: v.title, artist: v.artist, thumbnail: v.thumbnail, url });
        } catch {}
      }
      return out;
    }
  }
  return [];
}
