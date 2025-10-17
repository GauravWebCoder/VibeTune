-- Simple Supabase schema for music sync
-- Run this in your Supabase SQL Editor

-- Drop existing tables
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS room_users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- Create rooms table
CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host_id TEXT NOT NULL,
    host_username TEXT,
    current_song JSONB,
    is_playing BOOLEAN DEFAULT false,
    current_position REAL DEFAULT 0,
    volume REAL DEFAULT 0.5,
    queue JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create room_users table
CREATE TABLE room_users (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT DEFAULT '/music img.png',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Create chat_messages table
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    avatar TEXT DEFAULT '/music img.png',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_rooms_id ON rooms(id);
CREATE INDEX idx_room_users_room_id ON room_users(room_id);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all operations on room_users" ON room_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages FOR ALL USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_users;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Create storage bucket for songs (run this in Storage section if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('songs', 'songs', true);

-- Storage policies for songs bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'songs');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'songs');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'songs');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'songs');

SELECT 'Schema created successfully!' as status;
