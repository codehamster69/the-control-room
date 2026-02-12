# GAME ECONOMY SYSTEM

A complete backend game economy system with inflationary tokens, hunt bot automation, upgrades, ticket marketplace, and seasonal leaderboards.

## 📁 PROJECT STRUCTURE

```
lib/economy/
├── constants.ts          # All numeric constants and scaling formulas
├── types.ts             # TypeScript interfaces for economy system
├── utils.ts             # Helper functions for calculations
├── index.ts             # Module exports
└── services/
    ├── economy-service.ts       # Core token management & burns
    ├── hunt-bot-service.ts      # Automated item collection
    ├── upgrade-service.ts        # Bot, runtime, satellite upgrades
    ├── ticket-service.ts        # NFT-ready subscription tickets
    ├── marketplace-service.ts    # Ticket marketplace with burns
    └── leaderboard-service.ts   # Seasonal leaderboard

app/api/economy/
├── hunt/
│   ├── start/route.ts   # POST - Start free/paid hunt
│   └── collect/route.ts # POST - Collect completed hunt items
├── upgrades/route.ts    # POST - Upgrade bot/runtime/satellite
│                       # GET - Get upgrade status
├── items/sell/route.ts  # POST - Sell items for tokens
├── marketplace/route.ts # GET - Get listings
│                       # POST - List/buy/cancel tickets
├── status/route.ts     # GET - Get full economy status
└── tickets/
    └── activate/route.ts # POST - Activate subscription ticket

scripts/
└── economy-migration.sql  # Database schema migration

components/
└── hunt-bot-panel.tsx    # Hunt bot UI component
```

## 🎮 CORE FEATURES

### Token Economy

- **Inflationary Tokens**: Generated ONLY when users sell items
- **Token Burns**: Upgrades, marketplace trades (5%), paid runtime
- **Integer Storage**: All balances stored as integers (no floats)
- **Basis Points**: Percentages use BP (1% = 100 BP)

### Hunt Bot System

- **Base Rate**: 12 items/hour (0.2 items/minute)
- **Fractional Accumulation**: bot_accumulated_progress tracks partial items
- **Free Hunt**: 15 min duration, 5 hour cooldown
- **Paid Hunt**: User-defined runtime (15 min - 24 hours)
- **Power System**: Items add to total_power (never decreases)

### Upgrades

| Upgrade        | Base Cost | Growth Rate | Effect                     |
| -------------- | --------- | ----------- | -------------------------- |
| Bot Efficiency | 100       | 1.8         | +1 item/hour per level     |
| Max Runtime    | 150       | 2.0         | 15 \* (1.5^level) minutes  |
| Satellite      | 500       | 2.2         | +0.03% rare drop per level |

### Satellite System

- **No Hard Cap**: Can be upgraded infinitely
- **Aggressive Scaling**: Cost grows faster than production
- **Long-term Sink**: Primary token sink for endgame

### Ticket System (NFT-Ready)

- **30-Day Subscription**: Tickets grant 1 month access
- **NFT Integration**: Optional blockchain_token_id field
- **Transferable**: Tickets can be transferred between users
- **Marketplace**: Can be bought/sold for tokens

### Marketplace

- **5% Token Burn**: Every trade burns 5% of price
- **2% Platform Fee**: Optional fee for platform
- **Atomic Transactions**: Buyer deduction before seller credit

### Seasonal Leaderboard

- **30-Day Seasons**: Automatic reset
- **Seasonal Power**: Resets each season
- **Total Power**: Never resets (lifetime tracking)
- **Anti-Domination**: New players can compete each season

## 🔒 SECURITY

### Validations

- ✅ Server-side cooldown validation
- ✅ Race condition prevention (optimistic locking)
- ✅ Negative balance checks
- ✅ Max runtime bounds checking
- ✅ No overlapping bot sessions
- ✅ Free run cooldown enforcement

### Anti-Abuse

- ❌ No client time for validation
- ❌ No floating point math for tokens
- ❌ No manual time manipulation
- ❌ No ticket minting with tokens

## 💰 ECONOMIC BALANCE

### Monitoring

The system tracks:

- `total_tokens_generated` (from sales)
- `total_tokens_burned` (upgrades + marketplace + runtime)
- `tokens_generated_today`
- `tokens_burned_today`

### Target

- Burn rate ≈ Generation rate
- Adjust sell value and upgrade costs to balance

## 📊 FORMULAS

### Bot Items (Fractional)

```typescript
items_generated_raw = (effective_items_per_hour / 60) * minutes_run;
total_progress = accumulated + items_generated_raw;
items_granted = floor(total_progress);
accumulated = total_progress - items_granted;
```

### Upgrade Costs (Exponential)

```typescript
bot_upgrade = floor(100 * (1.8 ^ level));
runtime_upgrade = floor(150 * (2.0 ^ level));
satellite_upgrade = floor(500 * (2.2 ^ level));
```

### Max Runtime

```typescript
max_runtime = min(1440, floor(15 * (1.5 ^ level)));
```

### Satellite Bonus

```typescript
bonus_bp = level * 3; // 0.03% per level
```

### Marketplace Burn

```typescript
burn_amount = floor((price * 500) / 10000); // 5%
```

## 🚀 QUICK START

### 1. Run Migration

```bash
psql -f scripts/economy-migration.sql
# Or run in Supabase dashboard SQL editor
```

### 2. Start Free Hunt

```typescript
POST /api/economy/hunt/start
{ "session_type": "free" }
```

### 3. Collect Items

```typescript
POST / api / economy / hunt / collect;
// Returns items granted from completed session
```

### 4. Sell Items

```typescript
POST /api/economy/items/sell
{ "items_to_sell": 10 }
// Earns 10 * SELL_VALUE_PER_ITEM tokens
```

### 5. Upgrade Bot

```typescript
POST /api/economy/upgrades
{ "upgrade_type": "bot" }
// Burns tokens, increases efficiency
```

## 🔧 CONFIGURATION

Edit `lib/economy/constants.ts` to adjust:

```typescript
export const SELL_VALUE_PER_ITEM = 10; // Tokens earned per item
export const FREE_RUN_DURATION_MINUTES = 15;
export const FREE_RUN_COOLDOWN_HOURS = 5;
export const SEASON_DURATION_DAYS = 30;
export const MARKETPLACE_BURN_RATE_BP = 500; // 5%
```

## 📡 API REFERENCE

### Hunt Start

```
POST /api/economy/hunt/start
Body: { session_type: "free" | "paid", runtime_minutes?: number }
Response: { success, session_started, session_type, runtime_minutes }
```

### Hunt Collect

```
POST /api/economy/hunt/collect
Response: { success, session_ended, items_granted }
```

### Get Status

```
GET /api/economy/status
Response: { success, data: { user_state, bot, upgrades, leaderboard, ... } }
```

### Upgrade

```
POST /api/economy/upgrades
Body: { upgrade_type: "bot" | "runtime" | "satellite" }
Response: { success, new_level, tokens_spent }
```

### Sell Items

```
POST /api/economy/items/sell
Body: { items_to_sell: number }
Response: { success, items_sold, tokens_earned }
```

### Marketplace

```
GET /api/economy/marketplace
POST /api/economy/marketplace
Body: { action: "list" | "buy" | "cancel", ticket_id?, price?, listing_id? }
```

## 🎨 UI COMPONENTS

### HuntBotPanel

```tsx
import { HuntBotPanel } from "@/components/hunt-bot-panel";

// Full featured hunt bot UI with:
// - Progress bar during hunt
// - Free/Paid hunt buttons
// - Upgrade panel
// - Sell items functionality
```

## 📈 EXAMPLE FLOWS

### New User Signup

1. User signs up via existing auth
2. Instagram verification required
3. Profile created with defaults:
   - token_balance: 0
   - bot_items_per_hour_level: 0
   - bot_runtime_level: 0
   - satellite_level: 0
   - total_items_collected: 0
   - current_items_owned: 0
   - total_power: 0
   - seasonal_power_gain: 0

### User Uses Free Hunt

1. User clicks "FREE HUNT"
2. Server validates:
   - No active bot session
   - Cooldown expired (5 hours)
3. Bot started for 15 minutes
4. User waits or returns later
5. User clicks "COLLECT"
6. Items calculated with fractional progress
7. Stats updated atomically

### User Upgrades Bot

1. User views upgrade panel
2. Sees cost for next level
3. Clicks "UPGRADE"
4. Server validates balance
5. Tokens burned (tracked in metrics)
6. Bot level incremented
7. New efficiency rate applied

### User Sells Items

1. User has items from gacha/armory
2. Goes to Sell tab
3. Selects amount to sell
4. Server validates:
   - Amount > 0
   - Amount <= owned
5. Items decremented
6. Tokens credited (10 per item)
7. Generation tracked in metrics

### Season Reset

1. 30 days pass
2. LeaderboardService.checkSeasonReset() called
3. All users' seasonal_power_gain = 0
4. Season number increments
5. Total power unchanged

## ⚠️ IMPORTANT RULES

1. **Never use floats for tokens** - Always use integers
2. **Always floor() calculations** - Never round or ceil
3. **Track all burns** - Metrics must capture all destruction
4. **Server-side validation** - Never trust client data
5. **Atomic updates** - Use optimistic locking where possible
6. **Monitor economy** - Track generation vs burn ratios
