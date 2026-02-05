# VibeTune

<div align="center">
  <img src="public/VIBETUNE%20FULL.png" alt="VibeTune Logo" width="420" />
</div>

Real-time synchronized listening rooms with YouTube search, shared queue, and chat.

## Features
- Real-time sync: play, pause, seek, skip, shuffle, and queue updates across devices
- YouTube search and playlist import
- Shared queue with “Play Next”, remove, and auto-advance
- Auto-remove played songs (no repeat unless re-added)
- Responsive Spotify-inspired UI for desktop, tablet, and mobile
- Supabase for rooms, users, chat, and optional uploads
- Fast YouTube playback using server-side yt-dlp + caching

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express + Socket.io
- Database/Storage: Supabase (Postgres + Storage)

## Project Structure
```
vibetune/
  public/                 Static assets
  src/                    Frontend code
  server/                 Backend code
  supabase-schema.sql     Database schema
  SUPABASE_SETUP.md       Supabase setup guide
```

## Prerequisites
- Node.js 18+ (20+ recommended)
- npm
- Supabase project (URL + anon key)
- Backend needs Python + yt-dlp available

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SOCKET_SERVER_URL=https://your-backend-url
VITE_ENABLE_UPLOADS=false
```

### Backend (server/.env)
```
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_BUCKET=songs
UPLOAD_RETENTION_DAYS=3
CLEANUP_INTERVAL_HOURS=12
YT_URL_CACHE_TTL_MS=600000
PIPED_BASES=https://piped.video,https://pipedapi.kavin.rocks
```

## Local Development
```
# Frontend
npm install
npm run dev

# Backend
cd server
npm install
npm start
```

Frontend runs on `http://localhost:5173`  
Backend runs on `http://localhost:3001`

## Deployment (Vercel + Railway)
1. Push to GitHub
2. Deploy backend to Railway
   - Use `server/Dockerfile`
   - Set backend env vars
3. Deploy frontend to Vercel
   - Set `VITE_SOCKET_SERVER_URL` to Railway URL
4. Verify sync across two devices

## Notes
- YouTube playback depends on yt-dlp; keep it updated.
- The backend caches resolved YouTube stream URLs for faster playback.
- Auto-cleanup removes old chat messages and uploads after `UPLOAD_RETENTION_DAYS`.

## Troubleshooting
- If playback is slow: check Railway logs and ensure yt-dlp is updating.
- If YouTube search fails: verify backend health and `PIPED_BASES`.
- If sync mismatches: ensure only one backend is running per room.

## License
MIT
