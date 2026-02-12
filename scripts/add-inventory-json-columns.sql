-- Add inventory and collection_history JSON columns to profiles table
-- This replaces the separate inventory table for better performance

-- Add inventory column (stores {item_id: quantity} mapping)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '{}';

-- Add collection_history column (stores {item_id: total_collected} mapping)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS collection_history JSONB DEFAULT '{}';

-- Create indexes for JSONB columns to improve query performance
CREATE INDEX IF NOT EXISTS idx_profiles_inventory ON profiles USING GIN (inventory);
CREATE INDEX IF NOT EXISTS idx_profiles_collection_history ON profiles USING GIN (collection_history);

-- Add comment for documentation
COMMENT ON COLUMN profiles.inventory IS 'JSON mapping of item_id -> current_quantity';
COMMENT ON COLUMN profiles.collection_history IS 'JSON mapping of item_id -> total_collected_all_time';

-- Optional: Migrate existing data from inventory table if it exists
-- This transfers data from the old inventory table to the new JSON columns
DO $$
BEGIN
    -- Check if inventory table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
        -- Migrate inventory data
        UPDATE profiles p
        SET inventory = (
            SELECT jsonb_object_agg(item_id::text, quantity)
            FROM inventory i
            WHERE i.user_id = p.id
        )
        WHERE EXISTS (SELECT 1 FROM inventory WHERE user_id = p.id);
        
        -- Migrate collection history (set total_collected = current_quantity initially)
        UPDATE profiles p
        SET collection_history = inventory;
        
        RAISE NOTICE 'Migrated data from inventory table to JSON columns';
    END IF;
END $$;
