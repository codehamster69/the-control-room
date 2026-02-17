-- ==========================================================================
-- BILLING PAYMENT EVENTS + PURCHASE TRACKING
-- ==========================================================================

CREATE TABLE IF NOT EXISTS billing_payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  payment_ref TEXT NOT NULL UNIQUE,
  checkout_session_id TEXT NOT NULL,
  confirmed_provider_event_id TEXT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  currency TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL
    CHECK (status IN ('checkout_created', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_payment_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payment_ref TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  event_payload JSONB NOT NULL,
  processing_status TEXT NOT NULL
    CHECK (processing_status IN ('processing', 'processed', 'failed')),
  minted_quantity INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider_name, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_user_status
  ON billing_payments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_billing_payment_events_payment_ref
  ON billing_payment_events(payment_ref);

CREATE OR REPLACE FUNCTION set_billing_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_payments_updated_at ON billing_payments;
CREATE TRIGGER trg_billing_payments_updated_at
  BEFORE UPDATE ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION set_billing_payments_updated_at();

ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own billing payments" ON billing_payments;
CREATE POLICY "Users can read own billing payments"
  ON billing_payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert billing payments" ON billing_payments;
CREATE POLICY "System can insert billing payments"
  ON billing_payments FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update billing payments" ON billing_payments;
CREATE POLICY "System can update billing payments"
  ON billing_payments FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage billing payment events" ON billing_payment_events;
CREATE POLICY "System can manage billing payment events"
  ON billing_payment_events FOR ALL
  USING (true)
  WITH CHECK (true);
