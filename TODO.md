# The Control Room - Task List

## Completed Tasks ✅

### 1. Move Sell Feature to Armory

- [x] Removed sell tab from hunt-bot-panel.tsx
- [x] Added "SELL" filter tab to armory-grid.tsx
- [x] Implemented individual item selling with quantity selector
- [x] Implemented category-based selling (sell all items of a rarity)
- [x] Implemented "sell all" functionality
- [x] Sell value = item power (score_value)

### 1a. Armory Category Restructure

- [x] Changed tabs from "All, Owned, Not Owned, Collection, Sell" to "INVENTORY, COLLECTION, SELL"
- [x] INVENTORY tab: Shows only currently owned items with quantities
- [x] COLLECTION tab: Shows ALL items in the game
  - Items EVER received (owned or sold): Display with full rarity styling (colorful border/background), image, name, power
  - Items EVER received show collection quantity (total ever collected, never decreases)
  - Items NEVER received: Show gray "unrevealed" card with "?" mark, "???" name, "??? PWR"
- [x] SELL tab: Unchanged - sell interface for owned items

### 2. Remove Gacha/Spin Feature

- [x] Removed gacha page references from app/page.tsx
- [x] Removed gacha from navigation cards (now 2x2 grid without gacha)
- [x] Removed gacha from public landing page features
- [x] Gacha page files can be deleted (app/gacha/page.tsx, components/gacha-spinner.tsx)

### 3. Change Seasonal to Monthly Ranking

- [x] Updated leaderboard-view.tsx to have two tabs: Global and Monthly
- [x] Global leaderboard shows all-time total_power (never resets)
- [x] Monthly leaderboard shows monthly_power_gain (resets on 1st of month)
- [x] Updated hunt-bot-panel.tsx to show monthly_power_gain stat

### 4. Add All-Time Collection Section

- [x] Added "COLLECTION" filter tab to armory-grid.tsx
- [x] Collection shows all items ever collected (including sold items)
- [x] Shows "SOLD" badge for items that were collected but no longer in inventory
- [x] Collection progress counter in stats bar
- [x] Uses `collection_history` JSON column to track all-time collection

### 5. Remove CHAOS/SIMP Stats and Upgrade Features

- [x] Removed chaos_stat and simp_stat from hunt-bot-panel.tsx
- [x] Removed upgrade-related UI from hunt-bot-panel.tsx
- [x] Removed upgrade-related UI from armory-grid.tsx
- [x] Leaderboard now only shows power-based ranking

### 6. Two Leaderboards (Global & Monthly)

- [x] Global leaderboard: all-time power ranking
- [x] Monthly leaderboard: monthly power ranking with reset info
- [x] Both leaderboards accessible via tabs in leaderboard-view.tsx

### 7. Item Descriptions on Hover

- [x] Added description field to Item interface
- [x] Description tooltip appears on hover in armory-grid.tsx
- [x] Tooltip positioned above item with rarity-colored border

### 8. Admin Panel Description Field

- [x] Added description textarea to admin item form
- [x] Updated API to handle description field (POST and PUT)
- [x] Description shown in item list in admin panel

### 9. Fix Leaderboard Mobile Styling

- [x] Made leaderboard entries responsive (flex-wrap, min-w-0 for truncation)
- [x] Smaller avatars and fonts on mobile
- [x] Proper text truncation for long usernames
- [x] Compact power display on mobile
- [x] User rank section optimized for mobile

### 10. Mobile Responsiveness - All Pages

- [x] Added max-w-md mx-auto container to layout.tsx for mobile-first design
- [x] Updated app/page.tsx with responsive header (flex-col sm:flex-row, truncate username)
- [x] Updated app/hunt/page.tsx with responsive header sizing
- [x] Updated app/armory/page.tsx with px-2 sm:px-0 padding
- [x] Updated app/leaderboard/page.tsx with px-2 sm:px-0 padding
- [x] Updated app/community/page.tsx with responsive header, title sizing, and link cards
- [x] Updated app/profile/[id]/page.tsx with responsive stats, avatars, and grid layouts
- [x] All pages now use responsive text sizes (text-xs sm:text-sm, etc.)
- [x] Grid layouts use responsive columns (grid-cols-2 sm:grid-cols-4, etc.)

### 11. Cool Mobile Border Styling

- [x] Phone frame container with full border (not just left/right)
- [x] Gradient border effect (cyan → magenta → cyan → magenta) using border-image
- [x] Corner accent decorations (cyan top corners, fuchsia bottom corners)
- [x] Enhanced glow effects with multiple box-shadow layers
- [x] Added `borderRadius: '24px'` for smooth rounded phone-like corners
- [x] Body centered with `h-screen flex items-center justify-center`
- [x] Phone frame has fixed height `h-[95vh]` for realistic mobile proportions
- [x] Inner glow border effect for depth
- [x] Scrollable content area with `overflow-y-auto` inside the phone frame
- [x] Body has `overflow-hidden` to prevent background scroll
- [x] Custom scrollbar styling with cyberpunk gradient (cyan → magenta)
- [x] Thin scrollbar (6px width) with rounded track and thumb
- [x] Dark scrollbar track (#1a1a1a) matching the theme

## Files Modified

### Components

- `components/armory-grid.tsx` - Major rewrite with sell feature, collection view, descriptions
- `components/hunt-bot-panel.tsx` - Removed sell/chaos/simp/upgrade features
- `components/leaderboard-view.tsx` - Two-tab system, mobile optimization

### API Routes

- `app/api/admin/items/route.ts` - Added description field support
- `app/api/economy/status/route.ts` - Fixed leaderboard service integration

### Pages

- `app/page.tsx` - Removed gacha references
- `app/admin/page.tsx` - Added description field to item form

## Database Schema Notes

The following fields are used:

### Items Table

- `items.description` - Item description (nullable)
- `items.rarity` - Item rarity (Common, Uncommon, Rare, Epic, Legendary, Mythic)
- `items.score_value` - Item power value (used for sell price)

### Profiles Table

- `profiles.total_power` - All-time power (never resets)
- `profiles.monthly_power_gain` - Monthly power (resets on 1st of month)
- `profiles.total_items_collected` - All-time collection count
- `profiles.current_items_owned` - Current inventory count
- `profiles.token_balance` - User's token balance
- `profiles.inventory` - **JSONB column** storing `{item_id: quantity}` for current items
- `profiles.collection_history` - **JSONB column** storing `{item_id: total_collected}` for all-time tracking
- `profiles.bot_items_per_hour_level` - Hunt bot speed upgrade level
- `profiles.bot_runtime_level` - Max runtime upgrade level
- `profiles.satellite_level` - Rare drop chance upgrade level
- `profiles.bot_running_until` - Timestamp when bot session ends
- `profiles.bot_accumulated_progress` - Fractional item accumulation
- `profiles.last_free_run_at` - Last free hunt timestamp (for cooldown)

## JSON Inventory System

The inventory system now uses JSONB columns instead of separate tables:

1. **Current Inventory** (`profiles.inventory`):
   - Format: `{ "item-uuid-1": 5, "item-uuid-2": 3 }`
   - Tracks current quantities of owned items
   - Updated when items are granted (hunt) or sold

2. **Collection History** (`profiles.collection_history`):
   - Format: `{ "item-uuid-1": 10, "item-uuid-2": 5 }`
   - Tracks total items ever collected (never decreases)
   - Used for "All-Time Collection" view with SOLD badges

## Migration Scripts

- `scripts/add-inventory-json-columns.sql` - Adds inventory and collection_history JSONB columns
- `scripts/fix-missing-columns.sql` - Adds missing economy columns (monthly_power_gain, bot upgrade levels, etc.)

## Next Steps (Optional)

- [ ] Delete gacha page files if no longer needed (app/gacha/page.tsx, components/gacha-spinner.tsx)
- [ ] Test monthly reset functionality on 1st of month
- [ ] Consider adding GIN indexes on JSON columns for better query performance

## Remove Debugging from App

- [x] Remove error details exposure from API routes (status, hunt/start)
- [x] Remove console.error logs from sell API route

### 12. Dialog Close Button Visibility

- [x] Fixed close button styling in dialog component
- [x] Added circular shape with dark background for contrast
- [x] White X icon with hover effects (scale, background lighten)

### 13. Adjusted Rarity Drop Rates

- [x] Made Mythic items 100x more likely (0.01 → 1)
- [x] Made Legendary items 2.5x more likely (2 → 5)
- [x] New weights: Common(1000), Uncommon(300), Rare(50), Epic(10), Legendary(5), Mythic(1)
- [x] Mythic now achievable but still rare (1/1366 chance without satellite bonus)

### 14. Reduced Text Shadow Glow (Mobile Clarity)

- [x] Reduced all title text shadows from `0 0 5px #ff00ff, 0 0 8px #00ffff` to `0 0 2px #ff00ff`
- [x] Fixed blurry text on mobile screens by reducing glow intensity
- [x] Updated files: app/page.tsx, components/leaderboard-view.tsx, components/armory-grid.tsx, app/hunt/page.tsx, app/community/page.tsx, app/profile/[id]/page.tsx
- [x] Reduced question mark shadow in armory from `0 0 10px` to `0 0 2px`
