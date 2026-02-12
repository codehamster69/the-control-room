-- ============================================================================
-- ECONOMY SYSTEM MIGRATION
-- ============================================================================
-- This script adds all required economy fields and tables
-- Run this to set up the economy system

-- ============================================================================
-- ADD ECONOMY COLUMNS TO PROFILES TABLE
-- ============================================================================

-- Token Economy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_balance BIGINT DEFAULT 0;

-- Item Economy  
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_items_collected BIGINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_items_owned BIGINT DEFAULT 0;

-- Power System
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_power BIGINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seasonal_power_gain BIGINT DEFAULT 0;

-- Hunt Bot State
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_items_per_hour_level INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_runtime_level INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_accumulated_progress DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_running_until BIGINT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_free_run_at BIGINT DEFAULT NULL;

-- Satellite System
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS satellite_level INTEGER DEFAULT 0;

-- Subscription
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expiry BIGINT DEFAULT NULL;

-- Tickets (stored as JSON array)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owned_ticket_ids TEXT DEFAULT '[]';

-- ============================================================================
-- CREATE ECONOMY METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS economy_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  
  -- Token tracking
  total_tokens_generated BIGINT DEFAULT 0,
  total_tokens_burned BIGINT DEFAULT 0,
  tokens_generated_today BIGINT DEFAULT 0,
  tokens_burned_today BIGINT DEFAULT 0,
  
  -- Item economy
  total_items_sold BIGINT DEFAULT 0,
  total_items_generated BIGINT DEFAULT 0,
  
  -- Marketplace stats
  total_tickets_listed BIGINT DEFAULT 0,
  total_tickets_sold BIGINT DEFAULT 0,
  total_marketplace_volume BIGINT DEFAULT 0,
  
  -- Season tracking
  current_season_start BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  season_number INTEGER DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- ============================================================================
-- CREATE TICKETS TABLE (NFT-Ready)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_activated BOOLEAN DEFAULT false,
  issued_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  activated_at TIMESTAMP DEFAULT NULL,
  expires_at TIMESTAMP DEFAULT NULL,
  
  -- NFT integration
  blockchain_token_id TEXT,
  marketplace_listing_id TEXT,
  
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own tickets" ON tickets FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can update own tickets" ON tickets FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "System can create tickets" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own tickets" ON tickets FOR DELETE USING (auth.uid() = owner_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_owner_id ON tickets(owner_id);
CREATE INDEX IF NOT EXISTS idx_tickets_blockchain_token ON tickets(blockchain_token_id);

-- ============================================================================
-- CREATE TICKET MARKETPLACE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price BIGINT NOT NULL,
  listed_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  completed_at TIMESTAMP DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  
  UNIQUE(ticket_id)
);

-- Enable RLS
ALTER TABLE ticket_marketplace ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can read marketplace" ON ticket_marketplace FOR SELECT USING (true);
CREATE POLICY "Users can manage own listings" ON ticket_marketplace FOR ALL USING (auth.uid() = seller_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_seller_id ON ticket_marketplace(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listed_at ON ticket_marketplace(listed_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_completed ON ticket_marketplace(completed_at) WHERE completed_at IS NULL;

-- ============================================================================
-- CREATE MARKETPLACE TRANSACTIONS TABLE (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES ticket_marketplace(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price BIGINT NOT NULL,
  burn_amount BIGINT NOT NULL,
  platform_fee BIGINT NOT NULL,
  seller_receives BIGINT NOT NULL,
  completed_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),
  
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Enable RLS
ALTER TABLE marketplace_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own transactions" ON marketplace_transactions FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);
CREATE POLICY "System can insert transactions" ON marketplace_transactions FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON marketplace_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON marketplace_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_completed ON marketplace_transactions(completed_at);

-- ============================================================================
-- UPDATE LEADERBOARD VIEW FOR SEASONAL TRACKING
-- ============================================================================

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
  
  -- Item power from inventory
  COALESCE(
    SUM(
      FLOOR(
        i.score_value * (1 + COALESCE(up.upgrade_level, 0) * 0.2) * inv.quantity
      )
    ), 
    0
  ) as item_power,
  
  -- Total power
  p.chaos_stat + p.simp_stat + COALESCE(
    SUM(
      FLOOR(
        i.score_value * (1 + COALESCE(up.upgrade_level, 0) * 0.2) * inv.quantity
      )
    ), 
    0
  ) as total_power,
  
  -- Economy power (from hunt bot)
  COALESCE(p.total_power, 0) as economy_power
  
FROM profiles p
LEFT JOIN inventory inv ON p.id = inv.user_id
LEFT JOIN items i ON inv.item_id = i.id
LEFT JOIN item_upgrades up ON p.id = up.user_id AND inv.item_id = up.item_id
GROUP BY p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat, 
         p.instagram_username, p.instagram_avatar_url, p.total_power
ORDER BY (p.chaos_stat + p.simp_stat + COALESCE(
    SUM(
      FLOOR(
        i.score_value * (1 + COALESCE(up.upgrade_level, 0) * 0.2) * inv.quantity
      )
    ), 
    0
  )) DESC;

-- ============================================================================
-- CREATE SEASONAL LEADERBOARD VIEW
-- ============================================================================

DROP VIEW IF EXISTS seasonal_leaderboard;
CREATE VIEW seasonal_leaderboard AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.instagram_username,
  p.instagram_avatar_url,
  p.seasonal_power_gain,
  p.total_power,
  p.total_items_collected,
  
  -- Rank calculation using window function
  ROW_NUMBER() OVER (ORDER BY p.seasonal_power_gain DESC) as rank
FROM profiles p
WHERE p.is_instagram_verified = true
ORDER BY p.seasonal_power_gain DESC;

-- ============================================================================
-- CREATE ECONOMY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_token_balance ON profiles(token_balance);
CREATE INDEX IF NOT EXISTS idx_profiles_seasonal_power ON profiles(seasonal_power_gain DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_total_power ON profiles(total_power DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_expiry);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Atomic token deduction function
CREATE OR REPLACE FUNCTION deduct_tokens(
  user_id UUID,
  amount_to_deduct BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance BIGINT;
  new_balance BIGINT;
BEGIN
  -- Get current balance
  SELECT token_balance INTO current_balance
  FROM profiles
  WHERE id = user_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF current_balance < amount_to_deduct THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct tokens
  new_balance := current_balance - amount_to_deduct;
  
  UPDATE profiles
  SET token_balance = new_balance
  WHERE id = user_id;

  RETURN json_build_object('success', true, 'new_balance', new_balance);
END;
$$;

-- ============================================================================
-- DEFAULT METRICS ENTRY
-- ============================================================================

INSERT INTO economy_metrics (date, current_season_start, season_number)
VALUES (
  CURRENT_DATE,
  EXTRACT(EPOCH FROM NOW()) * 1000,
  1
)
ON CONFLICT (date) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Note: Run this migration with:
-- psql -f scripts/economy-migration.sql
-- Or via Supabase dashboard SQL editor

