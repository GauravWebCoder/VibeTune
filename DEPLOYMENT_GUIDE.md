# 🚀 VibeTune - Complete Deployment Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Backend Deployment (Railway - FREE)](#backend-deployment-railway---free)
4. [Frontend Deployment (Vercel - FREE)](#frontend-deployment-vercel---free)
5. [Database Setup (Supabase - FREE)](#database-setup-supabase---free)
6. [Environment Configuration](#environment-configuration)
7. [Testing & Troubleshooting](#testing--troubleshooting)
8. [Post-Deployment](#post-deployment)

---

## 🎯 Prerequisites

### Required Accounts (All FREE)
- ✅ **GitHub Account** - [github.com](https://github.com)
- ✅ **Railway Account** - [railway.app](https://railway.app) (Free tier: $5 credit/month)
- ✅ **Vercel Account** - [vercel.com](https://vercel.com) (Free tier: Unlimited)
- ✅ **Supabase Account** - [supabase.com](https://supabase.com) (Free tier: 500MB database)

### Required Software
- ✅ **Node.js** (v18 or higher) - [nodejs.org](https://nodejs.org)
- ✅ **Git** - [git-scm.com](https://git-scm.com)
- ✅ **Code Editor** (VS Code recommended)

---

## 🛠️ Project Setup

### Step 1: Prepare Your Repository

1. **Create a new repository on GitHub:**
   ```bash
   # If you haven't already
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/vibetune.git
   git push -u origin main
   ```

2. **Clean up your project:**
   ```bash
   # Remove node_modules and lock files
   rm -rf node_modules package-lock.json
   rm -rf server/node_modules server/package-lock.json
   
   # Reinstall dependencies
   npm install
   cd server && npm install && cd ..
   ```

3. **Create `.env` file in root directory:**
   ```env
   # Frontend Environment Variables
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   VITE_API_URL=https://your-railway-app.railway.app
   ```

4. **Create `.env` file in server directory:**
   ```env
   # Backend Environment Variables
   PORT=3001
   NODE_ENV=production
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

---

## 🚂 Backend Deployment (Railway - FREE)

### Step 1: Deploy to Railway

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up with GitHub** (click "Login with GitHub")
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your VibeTune repository**
6. **Railway will auto-detect your server folder**

### Step 2: Configure Railway Settings

1. **In Railway dashboard, click on your project**
2. **Go to "Settings" tab**
3. **Set Root Directory:**
   - Click "Add Variable"
   - Name: `RAILWAY_ROOT_DIRECTORY`
   - Value: `server`

4. **Add Environment Variables:**
   ```
   PORT=3001
   NODE_ENV=production
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

### Step 3: Deploy

1. **Click "Deploy"**
2. **Wait for deployment to complete** (2-3 minutes)
3. **Copy your Railway URL** (e.g., `https://vibetune-production.railway.app`)

### Step 4: Test Backend

1. **Visit your Railway URL** in browser
2. **You should see:** `{"message":"VibeTune Server is running!"}`
3. **Test API endpoint:** `https://your-railway-url.railway.app/api/health`

---

## ⚡ Frontend Deployment (Vercel - FREE)

### Step 1: Deploy to Vercel

1. **Go to [Vercel.com](https://vercel.com)**
2. **Sign up with GitHub** (click "Continue with GitHub")
3. **Click "New Project"**
4. **Import your VibeTune repository**
5. **Configure project settings:**

### Step 2: Configure Vercel Settings

1. **Framework Preset:** `Vite`
2. **Root Directory:** `./` (leave as root)
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Install Command:** `npm install`

### Step 3: Add Environment Variables

In Vercel dashboard, go to "Settings" → "Environment Variables":

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_API_URL=https://your-railway-url.railway.app
```

### Step 4: Deploy

1. **Click "Deploy"**
2. **Wait for build to complete** (1-2 minutes)
3. **Copy your Vercel URL** (e.g., `https://vibetune.vercel.app`)

---

## 🗄️ Database Setup (Supabase - FREE)

### Step 1: Create Supabase Project

1. **Go to [Supabase.com](https://supabase.com)**
2. **Sign up with GitHub**
3. **Click "New Project"**
4. **Choose organization and enter project details:**
   - Name: `vibetune`
   - Database Password: (generate strong password)
   - Region: Choose closest to your users
5. **Click "Create new project"**

### Step 2: Get Supabase Credentials

1. **Go to "Settings" → "API"**
2. **Copy these values:**
   - Project URL: `https://your-project.supabase.co`
   - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 3: Set Up Database Tables

1. **Go to "SQL Editor"**
2. **Run this SQL script:**

```sql
-- Create rooms table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  queue JSONB DEFAULT '[]'::jsonb,
  current_song JSONB,
  is_playing BOOLEAN DEFAULT false,
  current_time REAL DEFAULT 0
);

-- Create room_users table
CREATE TABLE room_users (
  id SERIAL PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audio_files table
CREATE TABLE audio_files (
  id SERIAL PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later)
CREATE POLICY "Allow all operations on rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all operations on room_users" ON room_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on audio_files" ON audio_files FOR ALL USING (true);
```

### Step 4: Configure Storage

1. **Go to "Storage"**
2. **Create a new bucket:**
   - Name: `audio-files`
   - Public: `true`
3. **Set up policies:**
   ```sql
   -- Allow public access to audio files
   CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'audio-files');
   CREATE POLICY "Allow uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-files');
   ```

---

## 🔧 Environment Configuration

### Update Your Code

1. **Update `src/utils/serverSync.js`:**
   ```javascript
   const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-railway-url.railway.app';
   ```

2. **Update `src/lib/supabase.js`:**
   ```javascript
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
   ```

3. **Update `server/server.js` (if needed):**
   ```javascript
   const PORT = process.env.PORT || 3001;
   ```

### Update Supabase Settings

1. **Go to Supabase Dashboard → Settings → API**
2. **Add to "Additional Redirect URLs":**
   - `https://your-vercel-app.vercel.app`
   - `https://your-railway-url.railway.app`

---

## 🧪 Testing & Troubleshooting

### Test Your Deployment

1. **Frontend Tests:**
   - ✅ Visit Vercel URL
   - ✅ Create a room
   - ✅ Upload music files
   - ✅ Test chat functionality
   - ✅ Test real-time sync

2. **Backend Tests:**
   - ✅ Visit Railway URL
   - ✅ Test API endpoints
   - ✅ Check server logs

3. **Database Tests:**
   - ✅ Check Supabase dashboard
   - ✅ Verify tables are created
   - ✅ Test data insertion

### Common Issues & Solutions

#### Issue 1: CORS Errors
**Solution:** Add CORS headers in your server:
```javascript
app.use(cors({
  origin: ['https://your-vercel-app.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

#### Issue 2: Environment Variables Not Working
**Solution:** 
- Check variable names (must start with `VITE_` for frontend)
- Redeploy after adding variables
- Check for typos

#### Issue 3: Build Failures
**Solution:**
- Check `package.json` scripts
- Ensure all dependencies are installed
- Check for TypeScript errors

#### Issue 4: Database Connection Issues
**Solution:**
- Verify Supabase URL and keys
- Check RLS policies
- Ensure tables exist

---

## 🎉 Post-Deployment

### Custom Domain (Optional)

1. **Vercel Custom Domain:**
   - Go to Vercel Dashboard → Settings → Domains
   - Add your custom domain
   - Update DNS records

2. **Railway Custom Domain:**
   - Go to Railway Dashboard → Settings → Domains
   - Add custom domain
   - Update DNS records

### Monitoring & Analytics

1. **Vercel Analytics:**
   - Enable in Vercel Dashboard
   - Monitor performance and usage

2. **Railway Monitoring:**
   - Check logs in Railway Dashboard
   - Monitor resource usage

3. **Supabase Monitoring:**
   - Check database usage
   - Monitor API calls

### Backup & Maintenance

1. **Database Backups:**
   - Supabase automatically backs up daily
   - Export data regularly

2. **Code Backups:**
   - Keep GitHub repository updated
   - Tag releases for easy rollback

---

## 💰 Cost Breakdown (All FREE)

| Service | Free Tier Limits | Your Usage |
|---------|------------------|------------|
| **Railway** | $5 credit/month | ~$0-2/month |
| **Vercel** | Unlimited deployments | $0/month |
| **Supabase** | 500MB database, 2GB bandwidth | $0/month |
| **GitHub** | Unlimited public repos | $0/month |
| **Total** | | **$0-2/month** |

---

## 🚀 Quick Deploy Commands

```bash
# 1. Prepare repository
git add .
git commit -m "Ready for deployment"
git push origin main

# 2. Deploy backend to Railway
# (Use Railway dashboard - no CLI needed)

# 3. Deploy frontend to Vercel
# (Use Vercel dashboard - no CLI needed)

# 4. Test deployment
curl https://your-railway-url.railway.app/api/health
open https://your-vercel-app.vercel.app
```

---

## 📞 Support & Resources

- **Railway Docs:** [docs.railway.app](https://docs.railway.app)
- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)
- **Vite Docs:** [vitejs.dev/guide](https://vitejs.dev/guide)

---

## ✅ Deployment Checklist

- [ ] GitHub repository created and pushed
- [ ] Railway backend deployed and tested
- [ ] Vercel frontend deployed and tested
- [ ] Supabase database set up with tables
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] All features tested
- [ ] Custom domain configured (optional)
- [ ] Monitoring enabled (optional)

---

**🎵 Your VibeTune app is now live and ready to rock! 🎵**

**Frontend:** `https://your-app.vercel.app`  
**Backend:** `https://your-app.railway.app`  
**Database:** `https://your-project.supabase.co`

---

*Last updated: January 2025*
