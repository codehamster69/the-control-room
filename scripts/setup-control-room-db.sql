-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  chaos_stat INTEGER DEFAULT 0,
  simp_stat INTEGER DEFAULT 0,
  power_stat INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Legendary')),
  score_value INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  UNIQUE(user_id, item_id)
);

-- Create gacha_logs table
CREATE TABLE IF NOT EXISTS gacha_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_spin_timestamp TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Create leaderboard view for power scores
-- Total Power = Chaos + Simp + Item Power (calculated from inventory)
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
  p.chaos_stat + p.simp_stat + COALESCE(SUM(i.score_value * inv.quantity), 0) as total_power
FROM profiles p
LEFT JOIN inventory inv ON p.id = inv.user_id
LEFT JOIN items i ON inv.item_id = i.id
GROUP BY p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat, p.instagram_username, p.instagram_avatar_url
ORDER BY total_power DESC;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for items
CREATE POLICY "Everyone can read items" ON items FOR SELECT USING (true);
CREATE POLICY "Only admins can insert items" ON items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can update items" ON items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can delete items" ON items FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- RLS Policies for inventory
CREATE POLICY "Users can read own inventory" ON inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert inventory" ON inventory FOR INSERT WITH CHECK (true);

-- RLS Policies for gacha_logs
CREATE POLICY "Users can read own gacha_logs" ON gacha_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gacha_logs" ON gacha_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gacha_logs" ON gacha_logs FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_gacha_logs_user_id ON gacha_logs(user_id);

-- =============================================
-- INSTAGRAM VERIFICATION TABLES AND COLUMNS
-- =============================================

-- Add Instagram verification columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_instagram_verified BOOLEAN DEFAULT false;

-- Create instagram_verifications table for tracking verification codes
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

-- Enable RLS for instagram_verifications
ALTER TABLE instagram_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instagram_verifications
CREATE POLICY "Users can read own instagram_verifications" ON instagram_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instagram_verifications" ON instagram_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instagram_verifications" ON instagram_verifications FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for instagram_verifications
CREATE INDEX IF NOT EXISTS idx_instagram_verifications_user_id ON instagram_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_verifications_code ON instagram_verifications(verification_code);

-- Update RLS policies for profiles to handle new Instagram columns
CREATE POLICY "Users can read instagram fields" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own instagram fields" ON profiles FOR UPDATE USING (auth.uid() = id);
