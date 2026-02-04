CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_sender_id ON gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_receiver_id ON gifts(receiver_id);

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read received gifts" ON gifts FOR SELECT USING (auth.uid() = receiver_id);
CREATE POLICY "Users can insert gifts" ON gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);
