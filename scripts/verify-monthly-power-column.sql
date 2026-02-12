-- Verify and fix monthly_power_gain column
-- This script ensures the column exists and has the correct type

-- First, check if the column exists
DO $$
BEGIN
    -- Add the column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'monthly_power_gain'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN monthly_power_gain INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added monthly_power_gain column';
    ELSE
        RAISE NOTICE 'monthly_power_gain column already exists';
    END IF;
END $$;

-- Verify the column type and set default if needed
ALTER TABLE profiles 
ALTER COLUMN monthly_power_gain SET DEFAULT 0;

-- Update any NULL values to 0
UPDATE profiles 
SET monthly_power_gain = 0 
WHERE monthly_power_gain IS NULL;

-- Also verify cost_per_hour_level exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'cost_per_hour_level'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN cost_per_hour_level INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added cost_per_hour_level column';
    END IF;
END $$;

-- Show current column info
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('monthly_power_gain', 'cost_per_hour_level', 'total_power', 'token_balance')
ORDER BY column_name;
