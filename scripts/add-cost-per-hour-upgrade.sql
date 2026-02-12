-- Add cost_per_hour_level column to profiles table
-- This tracks the upgrade level for reducing hunt cost per hour

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS cost_per_hour_level INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN profiles.cost_per_hour_level IS 'Upgrade level for reducing hunt cost per hour. Base: 120 tokens/hr, Min: 60 tokens/hr. Each level reduces cost gradually.';
