-- ==========================================================================
-- MARKETPLACE TICKET DOMAIN MODEL
-- ==========================================================================

CREATE TABLE IF NOT EXISTS marketplace_tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'fiat_mint'
    CHECK (source IN ('fiat_mint')),
  status TEXT NOT NULL DEFAULT 'owned'
    CHECK (status IN ('owned', 'listed', 'locked_in_trade', 'redeemed', 'cancelled')),
  redeem_value_months INTEGER NOT NULL DEFAULT 1
    CHECK (redeem_value_months = 1),
  listed_price_tokens BIGINT DEFAULT NULL CHECK (listed_price_tokens IS NULL OR listed_price_tokens > 0),
  active_trade_id UUID DEFAULT NULL,
  payment_ref TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferred_at TIMESTAMPTZ DEFAULT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NULL,

  CONSTRAINT marketplace_ticket_redeem_once CHECK (
    (status = 'redeemed' AND redeemed_at IS NOT NULL)
    OR
    (status <> 'redeemed' AND redeemed_at IS NULL)
  ),
  CONSTRAINT marketplace_ticket_listing_consistency CHECK (
    (status IN ('listed', 'locked_in_trade') AND listed_price_tokens IS NOT NULL)
    OR
    (status NOT IN ('listed', 'locked_in_trade') AND listed_price_tokens IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS marketplace_ticket_transfers (
  transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES marketplace_tickets(ticket_id) ON DELETE RESTRICT,
  trade_id UUID NOT NULL,
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_tickets_owner_status
  ON marketplace_tickets(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_tickets_status
  ON marketplace_tickets(status);

CREATE OR REPLACE FUNCTION set_marketplace_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_tickets_updated_at ON marketplace_tickets;
CREATE TRIGGER trg_marketplace_tickets_updated_at
  BEFORE UPDATE ON marketplace_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_marketplace_tickets_updated_at();

ALTER TABLE marketplace_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_ticket_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own marketplace tickets" ON marketplace_tickets;
CREATE POLICY "Users can read own marketplace tickets"
  ON marketplace_tickets FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update own marketplace tickets" ON marketplace_tickets;
CREATE POLICY "Users can update own marketplace tickets"
  ON marketplace_tickets FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "System can mint marketplace tickets" ON marketplace_tickets;
CREATE POLICY "System can mint marketplace tickets"
  ON marketplace_tickets FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own marketplace ticket transfers" ON marketplace_ticket_transfers;
CREATE POLICY "Users can read own marketplace ticket transfers"
  ON marketplace_ticket_transfers FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "System can create marketplace ticket transfers" ON marketplace_ticket_transfers;
CREATE POLICY "System can create marketplace ticket transfers"
  ON marketplace_ticket_transfers FOR INSERT
  WITH CHECK (true);
