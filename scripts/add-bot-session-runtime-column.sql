-- Add bot_session_runtime_minutes column to profiles table
-- This stores the actual runtime of the current hunt session for accurate progress calculation

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bot_session_runtime_minutes INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.bot_session_runtime_minutes IS 'Stores the actual runtime (in minutes) of the current hunt session. Used for accurate progress calculation.';

-- Create index for faster lookups (optional, but good for performance)
CREATE INDEX IF NOT EXISTS idx_profiles_bot_session_runtime 
ON profiles(bot_session_runtime_minutes) 
WHERE bot_session_runtime_minutes IS NOT NULL;
