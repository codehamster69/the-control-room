-- Support gift trades (price = 0) with explicit trade_type audit fields
ALTER TABLE marketplace_transactions
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS trade_type TEXT NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_transactions_trade_type_check'
  ) THEN
    ALTER TABLE marketplace_transactions
      ADD CONSTRAINT marketplace_transactions_trade_type_check
      CHECK (trade_type IN ('paid', 'gift'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_ticket ON marketplace_transactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_trade_type ON marketplace_transactions(trade_type);
