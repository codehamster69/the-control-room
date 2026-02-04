-- Simple migration to add community_links table and fix chaos/simp columns
-- Run this in Supabase SQL Editor - This is safer than the full migration

-- Step 1: Create community_links table
CREATE TABLE IF NOT EXISTS community_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_emoji TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Step 2: Enable RLS on community_links
ALTER TABLE community_links ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies for community_links
CREATE POLICY "Everyone can read active community_links" ON community_links FOR SELECT USING (is_active = true);
CREATE POLICY "Only admins can manage community_links" ON community_links FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_community_links_order ON community_links(display_order);
CREATE INDEX IF NOT EXISTS idx_community_links_active ON community_links(is_active);

-- Step 5: Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now() AT TIME ZONE 'utc'::text;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 6: Create trigger for community_links
DROP TRIGGER IF EXISTS update_community_links_updated_at ON community_links;
CREATE TRIGGER update_community_links_updated_at
  BEFORE UPDATE ON community_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Update existing profiles to add new columns if they don't exist
-- This uses DO block to safely add columns if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'instagram_username'
  ) THEN
    ALTER TABLE profiles ADD COLUMN instagram_username TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'instagram_avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN instagram_avatar_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'is_instagram_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_instagram_verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'chaos_stat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN chaos_stat DECIMAL(5,1) DEFAULT 0.0;
  ELSE
    -- If column exists, alter its type
    ALTER TABLE profiles ALTER COLUMN chaos_stat TYPE DECIMAL(5,1);
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'simp_stat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN simp_stat DECIMAL(5,1) DEFAULT 0.0;
  ELSE
    -- If column exists, alter its type
    ALTER TABLE profiles ALTER COLUMN simp_stat TYPE DECIMAL(5,1);
  END IF;
END $$;

-- Step 8: Add CHECK constraints for max values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_chaos_stat_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_chaos_stat_check 
    CHECK (chaos_stat >= 0 AND chaos_stat <= 50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_simp_stat_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_simp_stat_check 
    CHECK (simp_stat >= 0 AND simp_stat <= 50);
  END IF;
END $$;

-- Step 9: Create instagram_verifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS instagram_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  instagram_username TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Step 10: Enable RLS and create policies for instagram_verifications
ALTER TABLE instagram_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own instagram_verifications" ON instagram_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instagram_verifications" ON instagram_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instagram_verifications" ON instagram_verifications FOR UPDATE USING (auth.uid() = user_id);

-- Step 11: Create gacha_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS gacha_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_spin_timestamp TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Step 12: Enable RLS and create policies for gacha_logs
ALTER TABLE gacha_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gacha_logs" ON gacha_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gacha_logs" ON gacha_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gacha_logs" ON gacha_logs FOR UPDATE USING (auth.uid() = user_id);

-- Step 13: Create indexes
CREATE INDEX IF NOT EXISTS idx_gacha_logs_user_id ON gacha_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_verifications_user_id ON instagram_verifications(user_id);

-- Step 14: Recreate leaderboard view (drop first if exists)
DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.chaos_stat,
  p.simp_stat,
  p.instagram_username,
  p.instagram_avatar_url,
  COALESCE(SUM(i.score_value * inv.quantity), 0) as item_power,
  COALESCE(p.chaos_stat, 0) + COALESCE(p.simp_stat, 0) + COALESCE(SUM(i.score_value * inv.quantity), 0) as total_power
FROM profiles p
LEFT JOIN inventory inv ON p.id = inv.user_id
LEFT JOIN items i ON inv.item_id = i.id
GROUP BY p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat, p.instagram_username, p.instagram_avatar_url
ORDER BY total_power DESC;

