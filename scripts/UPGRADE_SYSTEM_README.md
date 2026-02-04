# Upgrade System Database Migration

## Overview

This migration adds the item upgrade system and updates the power calculation to include upgrade levels.

## Changes Made

### 1. Database Schema Changes

- Created `item_upgrades` table to track upgrade levels for each user's items
- Updated `leaderboard` view to calculate power based on upgrade levels
- Power formula: `base_power * (1 + upgrade_level * 0.2) * quantity`

### 2. Stat Progression Changes

All stats now increase gradually to prevent rapid progression:

#### SIMP Stat (Upgrade Success Bonus)

- **Success**: +0.5 SIMP per successful upgrade
- **Failure**: +0.2 SIMP per failed upgrade
- **Bonus**: 0.1% success rate increase per SIMP point
- **Display**: Shows with 1 decimal place (e.g., "5.5")

#### CHAOS Stat (Drop Rate Bonus)

- **Gacha Spin**: +0.5 CHAOS per spin
- **Upgrade Failure**: +0.3 CHAOS per failed upgrade
- **Bonus**: 0.1% drop rate increase per CHAOS point
- **Display**: Shows with 1 decimal place (e.g., "12.3")

### 3. Power Calculation

- **Item Power**: `base_power * (1 + upgrade_level * 0.2) * quantity`
- **Total Power**: `CHAOS + SIMP + Item Power`
- Each upgrade level adds 20% to the item's base power
- Power is floored to integer for display

### 4. Upgrade System

- Requires 2+ copies of an item to upgrade
- Consumes 1 copy on upgrade attempt (success or failure)
- Success chance decreases with each level:
  - Legendary: 80% - (level \* 10%)
  - Rare: 70% - (level \* 8%)
  - Common: 60% - (level \* 5%)
- SIMP stat provides gradual bonus to success rate

## Migration Steps

### Step 1: Run the SQL Migration

Execute the following SQL file in your Supabase SQL editor:

```bash
# File: scripts/add-item-upgrades.sql
```

This will:

1. Create the `item_upgrades` table
2. Set up RLS policies
3. Create indexes for performance
4. Update the `leaderboard` view with new power calculation

### Step 2: Update Existing User Stats (Optional)

If you want to normalize existing user stats to the new gradual system:

```sql
-- Scale down existing CHAOS and SIMP stats (divide by 2 for example)
UPDATE profiles
SET
  chaos_stat = chaos_stat / 2.0,
  simp_stat = simp_stat / 2.0
WHERE chaos_stat > 0 OR simp_stat > 0;
```

### Step 3: Verify the Changes

1. Check that the `item_upgrades` table exists
2. Verify the `leaderboard` view includes upgrade calculations
3. Test upgrading an item in the armory
4. Confirm power updates correctly after upgrade

## Testing Checklist

- [ ] Item upgrades consume 1 copy
- [ ] Successful upgrade increases item level
- [ ] Failed upgrade still consumes item
- [ ] SIMP increases by 0.5 on success, 0.2 on failure
- [ ] CHAOS increases by 0.3 on upgrade failure
- [ ] Power calculation includes upgrade bonus
- [ ] Total power updates in leaderboard after upgrade
- [ ] Stats display with 1 decimal place
- [ ] Success rate shows correct percentage based on SIMP

## Rollback (If Needed)

If you need to rollback these changes:

```sql
-- Drop the item_upgrades table
DROP TABLE IF EXISTS item_upgrades CASCADE;

-- Restore original leaderboard view
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.chaos_stat,
  p.simp_stat,
  p.instagram_username,
  p.instagram_avatar_url,
  COALESCE(SUM(i.score_value * inv.quantity), 0) as item_power,
  p.chaos_stat + p.simp_stat + COALESCE(SUM(i.score_value * inv.quantity), 0) as total_power
FROM profiles p
LEFT JOIN inventory inv ON p.id = inv.user_id
LEFT JOIN items i ON inv.item_id = i.id
GROUP BY p.id, p.username, p.avatar_url, p.chaos_stat, p.simp_stat, p.instagram_username, p.instagram_avatar_url
ORDER BY total_power DESC;
```

## Notes

- The gradual stat increase prevents users from reaching 100% success/drop rates too quickly
- Power calculation now properly reflects item upgrades
- All stat displays show 1 decimal place for clarity
- Total power is floored to integer for cleaner display
