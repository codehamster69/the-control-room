# Leaderboard Fix - TODO List

## Problem

The leaderboard query fails with 400 Bad Request because:

1. The `leaderboard` view doesn't have a `user_id` column (only `id`)
2. The view doesn't include Instagram-related columns

## Plan

- [x] 1. Update SQL script to fix the leaderboard view definition
- [x] 2. Update leaderboard-view.tsx to use correct column names
- [ ] 3. Run the SQL migration on Supabase

## Changes

### SQL Script (scripts/setup-control-room-db.sql)

- Added `instagram_username` and `instagram_avatar_url` to the leaderboard view
- Updated GROUP BY to include new columns

### Component (components/leaderboard-view.tsx)

- Changed `user_id` to `id` for the primary key
- Access Instagram columns directly from the view (no join needed)
- Updated type definition to include new columns

## Next Steps

Run the updated SQL on Supabase to recreate the leaderboard view:

1. Go to Supabase SQL Editor
2. Copy the CREATE VIEW statement from setup-control-room-db.sql
3. Execute it to update the leaderboard view
