-- Add missing Instagram columns to profiles table
-- Run this in Supabase SQL Editor

-- Add columns if they don't exist (using DO block to avoid errors)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'instagram_username'
    ) THEN
        ALTER TABLE profiles ADD COLUMN instagram_username TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'instagram_avatar_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN instagram_avatar_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_instagram_verified'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_instagram_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add chaos and simp stat columns if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'chaos_stat'
    ) THEN
        ALTER TABLE profiles ADD COLUMN chaos_stat DECIMAL(5,1) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'simp_stat'
    ) THEN
        ALTER TABLE profiles ADD COLUMN simp_stat DECIMAL(5,1) DEFAULT 0.0;
    END IF;
END $$;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

