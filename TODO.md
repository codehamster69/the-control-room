# The Control Room - Database Setup Guide

## Quick Fix for 406 Errors

The 406 "Not Acceptable" errors occur because the database tables are missing required columns. Run the migration script in Supabase SQL Editor.

## How to Fix

### Step 1: Run the Migration Script

1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of `scripts/simple-migration.sql`
3. Paste and click "Run"

This will:

- Create the `community_links` table
- Add missing columns to `profiles` (instagram_username, instagram_avatar_url, is_instagram_verified, chaos_stat, simp_stat)
- Add CHECK constraints for chaos/simp max values (50)
- Create `instagram_verifications` and `gacha_logs` tables if missing
- Recreate the `leaderboard` view

### Step 2: Verify It Worked

After running the migration, refresh your app. The 406 errors should be gone.

## Completed Changes

### 1. Leaderboard UI Fix

- Made user rank card sleek and compact
- Fixed alignment issues
- Changed to fixed bottom bar design

### 2. Community Page Simplification

- Dynamic admin-editable links
- Simplified to show only Instagram group chat links

### 3. Gacha Spinner Fixes

- Spin button disabled immediately on click
- Shows "COOLDOWN" during wait time
- Chaos bonus: +1% per point (max 50%)
- Chaos increment: +1 new item, +0.5 duplicate
- Shows "(MAX)" when stat reaches limit

### 4. Database Schema

- `chaos_stat`: DECIMAL(5,1), max 50
- `simp_stat`: DECIMAL(5,1), max 50
- `community_links` table for admin-managed links

## Troubleshooting

### If Simple Migration Fails

Try the full migration (will require data re-entry):

- `scripts/chaos-simp-limits-migration.sql`

### If Columns Still Missing

Run this quick fix in Supabase SQL Editor:

```sql
-- Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_instagram_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chaos_stat DECIMAL(5,1) DEFAULT 0.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS simp_stat DECIMAL(5,1) DEFAULT 0.0;

-- Drop and recreate leaderboard view
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
SELECT
  p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat,
  p.instagram_username, p.instagram_avatar_url,
  COALESCE(SUM(i.score_value * inv.quantity), 0) as item_power,
  COALESCE(p.chaos_stat, 0) + COALESCE(p.simp_stat, 0) + COALESCE(SUM(i.score_value * inv.quantity), 0) as total_power
FROM profiles p
LEFT JOIN inventory inv ON p.id = inv.user_id
LEFT JOIN items i ON inv.item_id = i.id
GROUP BY p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat, p.instagram_username, p.instagram_avatar_url
ORDER BY total_power DESC;
```
