-- Fix RLS policies for profiles and instagram_verifications tables
-- Run this in Supabase SQL Editor

-- First, ensure tables exist and have correct columns
-- (If tables don't exist, they need to be created first)

-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY IF NOT EXISTS;
ALTER TABLE instagram_verifications ENABLE ROW LEVEL SECURITY IF NOT EXISTS;
ALTER TABLE gacha_logs ENABLE ROW LEVEL SECURITY IF NOT EXISTS;

-- Drop existing RLS policies that might be causing issues
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read instagram fields" ON profiles;
DROP POLICY IF EXISTS "Users can read own instagram_verifications" ON instagram_verifications;
DROP POLICY IF EXISTS "Users can insert own instagram_verifications" ON instagram_verifications;
DROP POLICY IF EXISTS "Users can update own instagram_verifications" ON instagram_verifications;
DROP POLICY IF EXISTS "Users can read own gacha_logs" ON gacha_logs;
DROP POLICY IF EXISTS "Users can insert own gacha_logs" ON gacha_logs;
DROP POLICY IF EXISTS "Users can update own gacha_logs" ON gacha_logs;

-- Create new RLS policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for instagram_verifications
CREATE POLICY "Users can read own instagram_verifications" ON instagram_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instagram_verifications" ON instagram_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instagram_verifications" ON instagram_verifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for gacha_logs
CREATE POLICY "Users can read own gacha_logs" ON gacha_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gacha_logs" ON gacha_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gacha_logs" ON gacha_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gacha_logs_user_id ON gacha_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_verifications_user_id ON instagram_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_verifications_status ON instagram_verifications(status);

-- Verify the tables have the required columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'instagram_verifications' 
ORDER BY ordinal_position;

-- Show current RLS status
SELECT tablename, rowlevelsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

