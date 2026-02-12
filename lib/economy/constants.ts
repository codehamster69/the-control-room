/**
 * ECONOMY SYSTEM CONSTANTS
 * 
 * All numeric values are strict integers or basis points (BP).
 * 1% = 100 BP, 5% = 500 BP
 */

// ============================================================================
// TOKEN CONSTANTS
// ============================================================================

// Token values (in smallest unit - e.g., cents/smallest denomination)
export const SELL_VALUE_PER_ITEM = 10; // Tokens earned per item sold

// ============================================================================
// HUNT BOT CONSTANTS
// ============================================================================

export const BASE_ITEMS_PER_HOUR = 15;
export const BASE_COST_PER_HOUR = 120;

// Free Run Configuration
export const FREE_RUN_DURATION_MINUTES = 15;
export const FREE_RUN_COOLDOWN_HOURS = 5;

// ============================================================================
// BOT UPGRADE CONSTANTS
// ============================================================================

export const BOT_UPGRADE_BASE_COST = 100;
export const BOT_UPGRADE_GROWTH_RATE = 1.8;
export const MAX_ITEMS_PER_HOUR = 60; // Hard cap at 60 items/hour

// ============================================================================
// COST PER HOUR UPGRADE CONSTANTS
// ============================================================================

export const COST_PER_HOUR_UPGRADE_BASE_COST = 200;
export const COST_PER_HOUR_UPGRADE_GROWTH_RATE = 1.5;
export const MIN_COST_PER_HOUR = 60; // Minimum cost per hour (60 tokens)
export const MAX_COST_PER_HOUR_LEVEL = 100; // Max upgrade level

// ============================================================================
// RUNTIME UPGRADE CONSTANTS
// ============================================================================

export const BASE_RUNTIME_MINUTES = 15;
export const MAX_RUNTIME_MINUTES = 24 * 60; // 24 hours = 1440 minutes
export const RUNTIME_GROWTH_RATE = 1.5;

export const RUNTIME_UPGRADE_BASE_COST = 150;
export const RUNTIME_UPGRADE_GROWTH = 2.0;

// Runtime cost per minute (configurable)
export const RUNTIME_COST_PER_MINUTE = 1; // Base cost per minute of runtime

// ============================================================================
// SATELLITE SYSTEM CONSTANTS
// ============================================================================

// Satellite is VERY expensive - reaching 30% should take years
// Level 1000 = ~30% rare drop bonus (1000 * 0.03% = 30%)
// Cost grows exponentially: 1000 * (3.5 ^ level)
// Level 100 costs ~10^54 tokens (effectively impossible)
// Level 50 costs ~10^27 tokens (still impossible)
// Level 30 costs ~10^15 tokens (millions of billions)
// Level 20 costs ~10^10 tokens (10 billion)
// Level 10 costs ~10^5 tokens (100K)
// Level 5 costs ~10^3 tokens (1K)
export const SATELLITE_BASE_COST = 1000;
export const SATELLITE_GROWTH_RATE = 3.5; // Very steep growth
export const SATELLITE_INCREMENT_BP = 3; // 0.03% per level (3 basis points)
export const MAX_SATELLITE_LEVEL = 1000; // Cap at 1000 (30% bonus)

// ============================================================================
// MARKETPLACE CONSTANTS
// ============================================================================

export const MARKETPLACE_BURN_RATE_BP = 500; // 5% burn
export const MARKETPLACE_PLATFORM_FEE_BP = 200; // 2% platform fee

// ============================================================================
// SEASONAL LEADERBOARD CONSTANTS
// ============================================================================

export const SEASON_DURATION_DAYS = 30;

// ============================================================================
// TICKET CONSTANTS
// ============================================================================

export const TICKET_SUBSCRIPTION_DAYS = 30;

// ============================================================================
// ECONOMIC BALANCE MONITORING
// ============================================================================

// Target ratios for economic balance (for monitoring only, not enforcement)
export const TARGET_BURN_TO_GENERATION_RATIO = 1.0; // 1:1 target
export const ALLOWED_VARIANCE = 0.2; // ±20% allowed variance

// ============================================================================
// ANTI-CHEAT CONSTANTS
// ============================================================================

export const MAX_CONCURRENT_BOT_SESSIONS = 1;
export const MAX_PENDING_ITEM_GRANTS = 1000;
