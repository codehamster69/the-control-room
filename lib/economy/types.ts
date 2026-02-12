/**
 * ECONOMY SYSTEM TYPES - Simplified Version
 * 
 * All types for the game economy system.
 * Uses integer-only for token balances.
 */

// ============================================================================
// USER PROFILE EXTENSIONS (stored in profiles table)
// ============================================================================

export interface UserEconomyState {
  // Token Economy
  token_balance: number; // Integer (smallest unit)
  
  // Item Economy
  total_items_collected: number; // Lifetime items collected (ALL-TIME)
  current_items_owned: number; // Current inventory count
  
  // Power System (for leaderboards)
  total_power: number; // Lifetime power (ALL-TIME - never resets)
  monthly_power_gain: number; // Current month power (resets 1st of month)
  
  // Hunt Bot State
  bot_accumulated_progress: number; // Fractional item accumulation
  bot_running_until: number | null; // Unix timestamp when bot completes
  bot_session_runtime_minutes: number | null; // Actual runtime of current session
  last_free_run_at: number | null; // Unix timestamp of last free run
  
  // Upgrade Levels
  bot_items_per_hour_level: number; // Bot efficiency level
  bot_runtime_level: number; // Max runtime level
  satellite_level: number; // Satellite bonus level
  cost_per_hour_level: number; // Cost reduction level (reduces tokens/hour cost)
  
  // Subscription
  subscription_expiry: number | null; // Unix timestamp
  
  // Tickets (NFT-ready)
  owned_ticket_ids: string[]; // Array of ticket IDs
  
  // JSON Inventory (replaces separate inventory table)
  inventory: Record<string, number>; // {item_id: quantity} - current inventory
  collection_history: Record<string, number>; // {item_id: total_collected} - all time collection
}

// ============================================================================
// BOT STATE
// ============================================================================

export interface BotSession {
  user_id: string;
  started_at: number; // Unix timestamp
  ended_at: number | null; // Unix timestamp when completed
  runtime_minutes: number; // Requested runtime
  items_granted: number; // Items granted on completion
  is_active: boolean;
  session_type: 'free' | 'paid';
}

// ============================================================================
// TICKET SYSTEM (NFT-Ready)
// ============================================================================

export interface Ticket {
  id: string;
  owner_id: string;
  is_activated: boolean;
  issued_at: number; // Unix timestamp
  activated_at: number | null; // Unix timestamp
  expires_at: number | null; // Unix timestamp
  blockchain_token_id?: string; // Optional NFT token ID
  marketplace_listing_id?: string;
}

export interface TicketListing {
  id: string;
  ticket_id: string;
  seller_id: string;
  price: number; // Integer token price
  listed_at: number; // Unix timestamp
}

// ============================================================================
// MARKETPLACE
// ============================================================================

export interface MarketplaceListing {
  id: string;
  ticket_id: string;
  seller_id: string;
  seller_username?: string;
  price: number; // Integer tokens
  listed_at: number; // Unix timestamp
  ticket_activated: boolean;
  ticket_expires_at?: number;
}

export interface MarketplaceTransaction {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  price: number;
  burn_amount: number; // Tokens burned
  platform_fee: number; // Tokens to platform
  seller_receives: number;
  completed_at: number; // Unix timestamp
}

// ============================================================================
// ECONOMY METRICS (Global Tracking)
// ============================================================================

export interface EconomyMetrics {
  // Token tracking
  total_tokens_generated: number;
  total_tokens_burned: number;
  tokens_generated_today: number;
  tokens_burned_today: number;
  
  // Item economy
  total_items_sold: number;
  total_items_generated: number;
  
  // Marketplace stats
  total_tickets_listed: number;
  total_tickets_sold: number;
  total_marketplace_volume: number;
  
  // Monthly tracking
  current_month_start: number; // Unix timestamp
  current_month: string; // e.g., "2025-01"
}

// ============================================================================
// HUNT RESULT
// ============================================================================

export interface HuntResult {
  success: boolean;
  session_started: boolean;
  session_ended?: boolean;
  items_granted?: number;
  total_power_gained?: number;
  items_received?: { id: string; name: string; rarity: string; score_value: number }[];
  runtime_minutes?: number;
  session_type?: 'free' | 'paid';
  tokens_spent?: number;
  cost?: number; // Actual cost in berries for paid hunts
  error?: string;
  
  // Updated user state
  updated_state?: Partial<UserEconomyState>;
}


// ============================================================================
// UPGRADE RESULT
// ============================================================================

export interface UpgradeResult {
  success: boolean;
  upgrade_type: 'bot' | 'runtime' | 'satellite' | 'cost';
  new_level?: number;
  tokens_spent: number;
  error?: string;
  updated_state?: Partial<UserEconomyState>;
}

// ============================================================================
// SELL RESULT
// ============================================================================

export interface SellResult {
  success: boolean;
  items_sold: number;
  tokens_earned: number;
  breakdown?: { rarity: string; quantity: number; value: number }[];
  error?: string;
}

// ============================================================================
// ECONOMY STATUS (API Response)
// ============================================================================

export interface EconomyStatus {
  user_state: UserEconomyState | null;
  metrics: EconomyMetrics | null;
  
  // Bot status
  bot_is_running: boolean;
  bot_progress_percent: number;
  bot_remaining_minutes: number;
  bot_effective_rate: number; // items per hour
  
  // Subscription status
  is_subscribed: boolean;
  days_remaining: number;
  
  // Cooldowns
  free_run_available: boolean;
  free_run_cooldown_remaining: number; // seconds
  
  // Leaderboard
  monthly_rank: number | null;
  monthly_top_players: LeaderboardEntry[];
  global_rank: number | null;
  global_top_players: LeaderboardEntry[];
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url?: string;
  power: number;
  items_collected: number;
}

// ============================================================================
// INVENTORY WITH DESCRIPTION
// ============================================================================

export interface ItemWithDetails {
  id: string;
  name: string;
  rarity: string;
  description: string; // New field for hover description
  image_url?: string;
  score_value: number;
  quantity: number;
  isUnlocked: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
