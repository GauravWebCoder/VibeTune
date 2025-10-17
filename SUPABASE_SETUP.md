# Supabase Setup Guide

## Quick Setup (5 minutes)

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project to be ready

### 2. Run Database Schema
1. Go to SQL Editor in Supabase dashboard
2. Copy and paste the contents of `supabase-schema.sql`
3. Click "Run" to create tables

### 3. Create Storage Bucket (IMPORTANT!)
1. Go to **Storage** in Supabase dashboard
2. Click **"Create bucket"**
3. **Name**: `songs` (exactly this name - case sensitive!)
4. **Public**: ✅ **Check this box** (required for file access)
5. **File size limit**: 50MB (optional)
6. Click **"Create bucket"**

**⚠️ If you skip this step, file uploads will fail with "Bucket not found" error!**

### 4. Set Storage Policies
The storage policies are already included in the schema file, but if you need to run them separately:

In SQL Editor, run:
```sql
-- Allow public access to songs bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'songs');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'songs');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'songs');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'songs');
```

### 5. Get API Keys
1. Go to Settings > API
2. Copy your Project URL and anon key
3. Create `.env` file in project root:
```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 6. Test
1. Run `npm run dev`
2. Create a room and upload a song
3. Check Supabase dashboard to see data

## Troubleshooting

### "Bucket not found" Error
- Make sure bucket is named exactly `songs`
- Check bucket is public
- Verify storage policies are set

### "406 Not Acceptable" Error
- Check RLS policies in SQL Editor
- Make sure tables exist
- Verify API keys are correct

### Audio Playback Issues
- Use MP3 files for best compatibility
- Check file size (max 50MB)
- Try different browsers

## Free Tier Limits
- 500MB database storage
- 1GB file storage
- 2GB bandwidth/month
- 50,000 monthly active users

Perfect for development and small projects!
