-- Fix missing columns in profiles table
-- This migration adds columns needed for the economy system

-- Add monthly_power_gain column (replaces seasonal_power_gain)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS monthly_power_gain INTEGER DEFAULT 0;

-- Add bot_items_per_hour_level column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bot_items_per_hour_level INTEGER DEFAULT 0;

-- Add bot_runtime_level column  
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bot_runtime_level INTEGER DEFAULT 0;

-- Add satellite_level column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS satellite_level INTEGER DEFAULT 0;

-- Add bot_accumulated_progress column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bot_accumulated_progress INTEGER DEFAULT 0;

-- Add bot_running_until column (timestamp)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bot_running_until BIGINT;

-- Add last_free_run_at column (timestamp)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_free_run_at BIGINT;

-- Add subscription_expiry column (timestamp)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_expiry BIGINT;

-- Add owned_ticket_ids column (JSON array stored as text)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS owned_ticket_ids TEXT DEFAULT '[]';

-- Add economy metrics table if it doesn't exist
CREATE TABLE IF NOT EXISTS economy_metrics (
    date DATE PRIMARY KEY,
    total_tokens_generated INTEGER DEFAULT 0,
    total_tokens_burned INTEGER DEFAULT 0,
    tokens_generated_today INTEGER DEFAULT 0,
    tokens_burned_today INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    total_items_generated INTEGER DEFAULT 0,
    total_tickets_listed INTEGER DEFAULT 0,
    total_tickets_sold INTEGER DEFAULT 0,
    total_marketplace_volume INTEGER DEFAULT 0,
    current_month_start BIGINT,
    current_month TEXT
);

-- Add collection_history table if it doesn't exist (for tracking all-time collection)
CREATE TABLE IF NOT EXISTS collection_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_collection_history_user_id ON collection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_history_item_id ON collection_history(item_id);

-- Add description column to items table if it doesn't exist
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add inventory table if it doesn't exist
CREATE TABLE IF NOT EXISTS inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- Create indexes for inventory
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id);
