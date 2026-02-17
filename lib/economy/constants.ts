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
export const BOT_UPGRADE_GROWTH_RATE = 1.15; // Reduced from 1.8 for affordability
export const MAX_ITEMS_PER_HOUR = 60; // Hard cap at 60 items/hour
export const MAX_BOT_LEVEL = 45; // Max level (60 - 15 = 45 levels to go from 15 to 60 items/hr)

// ============================================================================
// COST PER HOUR UPGRADE CONSTANTS
// ============================================================================

export const COST_PER_HOUR_UPGRADE_BASE_COST = 200;
export const COST_PER_HOUR_UPGRADE_GROWTH_RATE = 1.06; // Reduced from 1.5 for affordability
export const MIN_COST_PER_HOUR = 60; // Minimum cost per hour (60 tokens)
export const MAX_COST_PER_HOUR_LEVEL = 100; // Max upgrade level

// ============================================================================
// RUNTIME UPGRADE CONSTANTS
// ============================================================================

export const BASE_RUNTIME_MINUTES = 15;
// Growth rate ~1.045 reaches 1440 minutes at level 100 (15 * 1.045^100 ≈ 1080 min)
// Slightly higher to ensure we hit 1440 by level 100
export const RUNTIME_GROWTH_RATE = 1.0467; // Exact rate to reach 1440 min at level 100
export const MAX_RUNTIME_MINUTES = 24 * 60; // 24 hours = 1440 minutes
export const MAX_RUNTIME_LEVEL = 100; // Max level for runtime upgrade

export const RUNTIME_UPGRADE_BASE_COST = 150;
export const RUNTIME_UPGRADE_GROWTH = 1.05; // Reduced from 1.15 for affordability

// Runtime cost per minute (configurable)
export const RUNTIME_COST_PER_MINUTE = 1; // Base cost per minute of runtime

// ============================================================================
// SATELLITE SYSTEM CONSTANTS
// ============================================================================

// Satellite bonus system - each level increases rare drop chance
// Level 300 = ~30% rare drop bonus (max achievable due to internal cap)
// Cost grows exponentially: base * (growth ^ level)
// Level 300 costs ~350M tokens (very expensive but achievable for dedicated players)
// Level 200 costs ~17M tokens
// Level 100 costs ~1.4M tokens
// Level 50 costs ~11K tokens
export const SATELLITE_BASE_COST = 1000;
export const SATELLITE_GROWTH_RATE = 1.10; // Slower growth for 300 levels
export const SATELLITE_INCREMENT_BP = 10; // 0.1% per level (10 basis points) - reaches cap at level 300
export const MAX_SATELLITE_LEVEL = 300; // Cap at 300 (30% bonus - matches internal cap)

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
