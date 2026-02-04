-- Create item_upgrades table to track upgrade levels
CREATE TABLE IF NOT EXISTS item_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  upgrade_level INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  UNIQUE(user_id, item_id)
);

-- Enable RLS for item_upgrades
ALTER TABLE item_upgrades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for item_upgrades
CREATE POLICY "Users can read own item_upgrades" ON item_upgrades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own item_upgrades" ON item_upgrades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own item_upgrades" ON item_upgrades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own item_upgrades" ON item_upgrades FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_upgrades_user_id ON item_upgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_item_upgrades_item_id ON item_upgrades(item_id);

-- Update leaderboard view to include upgrade levels in power calculation
-- Power calculation: base_power * (1 + upgrade_level * 0.2) * quantity
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
  COALESCE(
    SUM(
      FLOOR(
        i.score_value * (1 + COALESCE(up.upgrade_level, 0) * 0.2) * inv.quantity
      )
    ), 
    0
  ) as item_power,
  p.chaos_stat + p.simp_stat + COALESCE(
    SUM(
      FLOOR(
        i.score_value * (1 + COALESCE(up.upgrade_level, 0) * 0.2) * inv.quantity
      )
    ), 
    0
  ) as total_power
FROM profiles p
LEFT JOIN inventory inv ON p.id = inv.user_id
LEFT JOIN items i ON inv.item_id = i.id
LEFT JOIN item_upgrades up ON p.id = up.user_id AND inv.item_id = up.item_id
GROUP BY p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat, p.instagram_username, p.instagram_avatar_url
ORDER BY total_power DESC;
