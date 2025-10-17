# 🚀 VibeTune - Complete Deployment Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Backend Deployment (Railway - FREE)](#backend-deployment-railway---free)
3. [Frontend Deployment (Vercel - FREE)](#frontend-deployment-vercel---free)
4. [Environment Configuration](#environment-configuration)
5. [Testing & Troubleshooting](#testing--troubleshooting)
6. [Post-Deployment](#post-deployment)

---

## 🎯 Prerequisites

### Required Accounts (All FREE)
- ✅ **GitHub Account** - [github.com](https://github.com)
- ✅ **Railway Account** - [railway.app](https://railway.app) (Free tier: $5 credit/month)
- ✅ **Vercel Account** - [vercel.com](https://vercel.com) (Free tier: Unlimited)

### Required Software
- ✅ **Node.js** (v18 or higher) - [nodejs.org](https://nodejs.org)
- ✅ **Git** - [git-scm.com](https://git-scm.com)
- ✅ **Code Editor** (VS Code recommended)

---

## 🚂 Backend Deployment (Railway - FREE)

### Step 1: Prepare Your Backend Code

1. **Open your project folder** in VS Code or your preferred editor
2. **Navigate to the server folder**:
   ```bash
   cd server
   ```

3. **Check your server files** - you should have:
   - `server.js` (main server file)
   - `package.json` (dependencies)
   - `package-lock.json` (dependency lock file)

4. **Verify your server.js** - it should contain:
   - Express server setup
   - CORS configuration
   - API routes for room management
   - Audio file handling

### Step 2: Create Railway Account

1. **Go to [railway.app](https://railway.app)**
2. **Click "Start a New Project"**
3. **Sign up with GitHub** (recommended - click "Login with GitHub")
   - This connects your GitHub account to Railway
   - Makes deployment easier
4. **Verify your email** if prompted

### Step 3: Deploy Backend to Railway

1. **In Railway dashboard**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your VibeTune repository from the list

2. **Configure the deployment**:
   - Railway will auto-detect it's a Node.js project
   - **IMPORTANT**: Set the **Root Directory** to `server`
     - Click on your project
     - Go to "Settings" tab
     - Find "Root Directory" setting
     - Change it from `/` to `server`
   - Click "Deploy"

3. **Wait for deployment** (2-3 minutes):
   - Watch the build logs in the Railway dashboard
   - Look for "Build successful" message
   - Note the generated URL (e.g., `https://your-app-name.railway.app`)

### Step 4: Set Up Environment Variables in Railway

1. **In your Railway project dashboard**:
   - Click on your deployed service
   - Go to "Variables" tab
   - Add these environment variables one by one:

   ```
   PORT=3001
   NODE_ENV=production
   ```

2. **Add your Supabase credentials** (you mentioned you'll handle this):
   ```
   SUPABASE_URL=https://bnkiywquozlymthlyvez.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJua2l5d3F1b3pseW10aGx5dmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTY3NDgsImV4cCI6MjA3NjA5Mjc0OH0.P89Kht2kue5XCi_Zhjf8-rvbnBnGCxuLHmCup1NfhLg
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJua2l5d3F1b3pseW10aGx5dmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUxNjc0OCwiZXhwIjoyMDc2MDkyNzQ4fQ.XwRsU7Z60KHPN5-vAKyirBAXn4P9QDlLVueq0zxpGuY
   ```

3. **Click "Deploy"** to restart with new variables

### Step 5: Test Your Backend

1. **Get your Railway URL**:
   - In Railway dashboard, copy the URL (e.g., `https://your-app-name.railway.app`)
   - Test it in browser - you should see your API response

2. **Test API endpoints**:
   - Try: `https://your-app-name.railway.app/api/health` (if you have this endpoint)
   - Or: `https://your-app-name.railway.app/` (should show your server response)

3. **Note your backend URL** - you'll need this for the frontend deployment

---

## 🌐 Frontend Deployment (Vercel - FREE)

### Step 1: Create Vercel Account

1. **Go to [vercel.com](https://vercel.com)**
2. **Click "Sign Up"**
3. **Sign up with GitHub** (recommended)
   - This connects your GitHub account to Vercel
   - Makes deployment automatic

### Step 2: Deploy Frontend to Vercel

1. **In Vercel dashboard**:
   - Click "New Project"
   - Select "Import Git Repository"
   - Choose your VibeTune repository

2. **Configure the deployment**:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: Leave as `/` (default)
   - **Build Command**: `npm run build` (should auto-fill)
   - **Output Directory**: `dist` (should auto-fill)

3. **Add Environment Variables**:
   - Click "Environment Variables" section
   - Add these variables:
   ```
   VITE_SUPABASE_URL=https://bnkiywquozlymthlyvez.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJua2l5d3F1b3pseW10aGx5dmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTY3NDgsImV4cCI6MjA3NjA5Mjc0OH0.P89Kht2kue5XCi_Zhjf8-rvbnBnGCxuLHmCup1NfhLg
   VITE_API_URL=https://vibetune-production.up.railway.app/

4. **Click "Deploy"**
5. **Wait for deployment** (2-3 minutes)

### Step 3: Get Your Frontend URL

1. **After deployment completes**:
   - Vercel will show your live URL
   - Example: `https://vibetune-abc123.vercel.app`
   - This is your live website!

2. **Test your website**:
   - Open the URL in your browser
   - Try creating a room
   - Test the music functionality

---

## ⚙️ Environment Configuration

### Backend Environment Variables (Railway)

In your Railway project, add these variables:

```
PORT=3000
NODE_ENV=production
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### Frontend Environment Variables (Vercel)

In your Vercel project, add these variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=https://your-railway-app.railway.app
```

### How to Find Your Supabase Credentials

1. **Go to your Supabase dashboard**
2. **Click on your project**
3. **Go to Settings → API**
4. **Copy these values**:
   - **Project URL** → Use for `SUPABASE_URL`
   - **anon public** → Use for `SUPABASE_ANON_KEY`
   - **service_role** → Use for `SUPABASE_SERVICE_KEY`

---

## 🧪 Testing & Troubleshooting

### Test Your Deployment

1. **Test Backend**:
   - Visit your Railway URL
   - Should show your API response
   - Test API endpoints

2. **Test Frontend**:
   - Visit your Vercel URL
   - Try creating a room
   - Test music upload and playback
   - Test chat functionality

### Common Issues & Solutions

#### Backend Issues

**Problem**: Railway deployment fails
**Solution**: 
- Check if `server` folder exists
- Verify `package.json` is in server folder
- Check build logs in Railway dashboard

**Problem**: API not responding
**Solution**:
- Check environment variables in Railway
- Verify Supabase credentials
- Check server logs in Railway dashboard

#### Frontend Issues

**Problem**: Vercel deployment fails
**Solution**:
- Check if `package.json` exists in root
- Verify build command is `npm run build`
- Check build logs in Vercel dashboard

**Problem**: Frontend can't connect to backend
**Solution**:
- Verify `VITE_API_URL` in Vercel environment variables
- Make sure Railway backend is running
- Check CORS settings in backend

### Getting Help

1. **Check the logs**:
   - Railway: Go to your project → "Deployments" → Click on deployment → View logs
   - Vercel: Go to your project → "Functions" → View function logs

2. **Common error messages**:
   - `Module not found`: Missing dependencies
   - `Port already in use`: Change PORT environment variable
   - `CORS error`: Check CORS settings in backend

---

## 🎉 Post-Deployment

### Your Live URLs

After successful deployment, you'll have:

- **Frontend**: `https://your-app-name.vercel.app`
- **Backend**: `https://your-app-name.railway.app`

### Share Your App

1. **Share the frontend URL** with friends
2. **Test with multiple users** in the same room
3. **Monitor usage** in Railway and Vercel dashboards

### Maintenance

1. **Automatic deployments**:
   - Push to GitHub → Vercel auto-deploys frontend
   - Push to GitHub → Railway auto-deploys backend

2. **Monitoring**:
   - Check Railway dashboard for backend health
   - Check Vercel dashboard for frontend performance

3. **Updates**:
   - Make changes to your code
   - Push to GitHub
   - Both platforms will automatically redeploy

---

## 🎯 Summary

You now have:
- ✅ **Backend deployed** on Railway (FREE)
- ✅ **Frontend deployed** on Vercel (FREE)
- ✅ **Database configured** with Supabase
- ✅ **Live website** ready to use!

**Your VibeTune app is now live and ready to share!** 🎵✨

---

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the logs in Railway/Vercel dashboards
3. Verify all environment variables are set correctly
4. Make sure your Supabase database is properly configured

**Happy coding!** 🚀