-- Create community_links table for admin-editable Instagram group chat links
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

-- Enable RLS for community_links
ALTER TABLE community_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_links
CREATE POLICY "Everyone can read active community_links" ON community_links FOR SELECT USING (
  is_active = true
);

CREATE POLICY "Only admins can manage community_links" ON community_links FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Create indexes for community_links
CREATE INDEX IF NOT EXISTS idx_community_links_order ON community_links(display_order);
CREATE INDEX IF NOT EXISTS idx_community_links_active ON community_links(is_active);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now() AT TIME ZONE 'utc'::text;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_community_links_updated_at ON community_links;
CREATE TRIGGER update_community_links_updated_at
  BEFORE UPDATE ON community_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

