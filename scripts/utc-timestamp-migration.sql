-- =============================================
-- UTC TIMESTAMP MIGRATION
-- Update timestamp columns to use UTC timezone
-- Run this migration to fix timezone issues
-- =============================================

-- Update gacha_logs table to use UTC timestamp
ALTER TABLE gacha_logs 
ALTER COLUMN last_spin_timestamp SET DEFAULT (now() AT TIME ZONE 'utc'::text);

-- Update existing gacha_logs timestamps to UTC format
UPDATE gacha_logs 
SET last_spin_timestamp = TO_CHAR(last_spin_timestamp AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE last_spin_timestamp IS NOT NULL 
  AND last_spin_timestamp::text NOT LIKE '%Z';

-- Update instagram_verifications table to use UTC timestamp
ALTER TABLE instagram_verifications 
ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'utc'::text);

-- Update existing instagram_verifications timestamps to UTC format
UPDATE instagram_verifications 
SET created_at = TO_CHAR(created_at AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE created_at IS NOT NULL 
  AND created_at::text NOT LIKE '%Z';

-- Also update expires_at to be stored as UTC text
ALTER TABLE instagram_verifications 
ALTER COLUMN expires_at SET DEFAULT (now() AT TIME ZONE 'utc'::text);

-- =============================================
-- Helper function to get current UTC timestamp
-- =============================================

-- Create a function to get current UTC timestamp in ISO format
CREATE OR REPLACE FUNCTION current_utc_timestamp()
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(NOW() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Verification
-- =============================================

-- Check current timestamp format
-- Should show: 2024-01-15T10:30:45.123Z format
SELECT 'gacha_logs.last_spin_timestamp' as table_column, 
       last_spin_timestamp as sample_value 
FROM gacha_logs 
LIMIT 1;

SELECT 'instagram_verifications.created_at' as table_column, 
       created_at as sample_value 
FROM instagram_verifications 
LIMIT 1;

