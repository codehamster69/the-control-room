/**
 * HUNT BOT SERVICE
 * 
 * Handles the automated item collection system.
 * Free runs and paid runs with fractional accumulation.
 * 
 * IMPORTANT: All calculations must be server-side.
 */

import { createClient } from '@/lib/supabase/server';
import { 
  UserEconomyState, 
  HuntResult,
} from '../types';
import {
  calculateItemsGranted,
  calculateBotProgressPercent,
  calculateRemainingMinutes,
  isFreeRunCooldownExpired,
  getFreeRunCooldownRemaining,
  calculateCostPerHour,
} from '../utils';
import {
  FREE_RUN_DURATION_MINUTES,
  BASE_ITEMS_PER_HOUR,
  BASE_COST_PER_HOUR,
} from '../constants';
import { calculateMaxRuntimeMinutes } from '../utils';

export class HuntBotService {
  private supabase: any;
  private userId: string;

  constructor(supabaseClient: any, userId: string) {
    this.supabase = supabaseClient;
    this.userId = userId;
  }

  /**
   * Get user's current bot status
   */
  async getBotStatus(): Promise<{
    effectiveRate: number;
    accumulatedProgress: number;
    isRunning: boolean;
    progressPercent: number;
    remainingMinutes: number;
    freeRunAvailable: boolean;
    cooldownRemaining: number;
  }> {
    const state = await this.getUserState();
    const now = Date.now();
    
    let isRunning = false;
    let progressPercent = 0;
    let remainingMinutes = 0;

    if (state.bot_running_until && state.bot_running_until > now) {
      isRunning = true;
      // Use the stored session runtime, or estimate from remaining time if not available
      const sessionEnd = state.bot_running_until;
      // Calculate runtime from the stored start time or estimate from remaining time
      const remainingMs = sessionEnd - now;
      const remainingMins = Math.ceil(remainingMs / (60 * 1000));
      // For existing hunts without stored runtime, estimate from remaining time
      // Add a small buffer to ensure we don't underestimate
      const estimatedRuntime = state.bot_session_runtime_minutes || Math.max(FREE_RUN_DURATION_MINUTES, remainingMins + 1);
      const runtimeMinutes = estimatedRuntime;
      const startedAt = sessionEnd - (runtimeMinutes * 60 * 1000);
      
      progressPercent = calculateBotProgressPercent(
        startedAt, 
        runtimeMinutes, 
        now
      );
      remainingMinutes = calculateRemainingMinutes(
        startedAt, 
        runtimeMinutes, 
        now
      );
    }

    const freeRunAvailable = isFreeRunCooldownExpired(state.last_free_run_at);
    const cooldownRemaining = getFreeRunCooldownRemaining(state.last_free_run_at);

    // Calculate effective items per hour based on upgrade level
    const effectiveRate = BASE_ITEMS_PER_HOUR + (state.bot_items_per_hour_level * 1);

    return {
      effectiveRate,
      accumulatedProgress: state.bot_accumulated_progress || 0,
      isRunning,
      progressPercent,
      remainingMinutes,
      freeRunAvailable,
      cooldownRemaining,
    };
  }

  /**
   * Start a free hunt run
   * Rules:
   * - Fixed 15 minutes duration
   * - Cost = 0 tokens
   * - 5 hour cooldown
   * - Cannot run if bot already active
   */
  async startFreeHunt(): Promise<HuntResult> {
    const now = Date.now();
    const state = await this.getUserState();

    // Check if bot is already running
    if (state.bot_running_until && state.bot_running_until > now) {
      return {
        success: false,
        session_started: false,
        error: 'Bot is already running',
      };
    }

    // Check cooldown
    const cooldownExpired = isFreeRunCooldownExpired(state.last_free_run_at);
    if (!cooldownExpired) {
      const remaining = getFreeRunCooldownRemaining(state.last_free_run_at);
      return {
        success: false,
        session_started: false,
        error: `Cooldown not finished. ${Math.ceil(remaining / 60)} minutes remaining.`,
      };
    }

    // Start the bot session
    const endTime = now + (FREE_RUN_DURATION_MINUTES * 60 * 1000);

    // Simple update without optimistic locking
    const { error } = await this.supabase
      .from('profiles')
      .update({
        bot_running_until: endTime,
        bot_session_runtime_minutes: FREE_RUN_DURATION_MINUTES,
        last_free_run_at: now,
      })
      .eq('id', this.userId);

    if (error) {
      return {
        success: false,
        session_started: false,
        error: 'Failed to start bot session',
      };
    }

    return {
      success: true,
      session_started: true,
      session_type: 'free',
      runtime_minutes: FREE_RUN_DURATION_MINUTES,
      updated_state: {
        bot_running_until: endTime,
        last_free_run_at: now,
      },
    };
  }

  /**
   * Start a paid hunt run
   * Rules:
   * - Variable duration (up to max runtime based on upgrades)
   * - Cost = 1 token per minute
   * - No cooldown
   * - Cannot run if bot already active
   */
  async startPaidHunt(runtimeMinutes: number): Promise<HuntResult> {
    const now = Date.now();
    const state = await this.getUserState();

    // Check if bot is already running
    if (state.bot_running_until && state.bot_running_until > now) {
      return {
        success: false,
        session_started: false,
        error: 'Bot is already running',
      };
    }

    // Calculate max runtime based on upgrade level
    const maxRuntime = calculateMaxRuntimeMinutes(state.bot_runtime_level);
    
    // Validate runtime
    if (runtimeMinutes < 15) {
      return {
        success: false,
        session_started: false,
        error: 'Minimum runtime is 15 minutes',
      };
    }
    
    if (runtimeMinutes > maxRuntime) {
      return {
        success: false,
        session_started: false,
        error: `Maximum runtime is ${maxRuntime} minutes with your current upgrades`,
      };
    }

    // Calculate cost based on cost per hour upgrade level
    const costPerHour = calculateCostPerHour(state.cost_per_hour_level);
    const cost = Math.ceil((runtimeMinutes / 60) * costPerHour);

    // Check token balance
    if (state.token_balance < cost) {
      return {
        success: false,
        session_started: false,
        error: `Insufficient tokens. Need ${cost} tokens for ${runtimeMinutes} minutes at ${costPerHour} tokens/hour.`,
      };
    }

    // Start the bot session
    const endTime = now + (runtimeMinutes * 60 * 1000);

    const { error } = await this.supabase
      .from('profiles')
      .update({
        bot_running_until: endTime,
        bot_session_runtime_minutes: runtimeMinutes,
        token_balance: state.token_balance - cost,
      })
      .eq('id', this.userId);

    if (error) {
      return {
        success: false,
        session_started: false,
        error: 'Failed to start paid bot session',
      };
    }

    return {
      success: true,
      session_started: true,
      session_type: 'paid',
      runtime_minutes: runtimeMinutes,
      tokens_spent: cost,
      updated_state: {
        bot_running_until: endTime,
        token_balance: state.token_balance - cost,
      },
    };
  }


  /**
   * Collect items from a completed bot session
   */
  async collectItems(): Promise<HuntResult> {
    const now = Date.now();
    const state = await this.getUserState();

    // Check if bot session has completed
    if (!state.bot_running_until || state.bot_running_until > now) {
      return {
        success: false,
        session_started: false,
        session_ended: false,
        error: 'Bot session not completed yet',
      };
    }

    // Calculate effective items per hour based on upgrade level
    const effectiveItemsPerHour = BASE_ITEMS_PER_HOUR + (state.bot_items_per_hour_level * 1);
    
    // Use the stored session runtime for accurate calculation
    const runtimeMinutes = state.bot_session_runtime_minutes || FREE_RUN_DURATION_MINUTES;

    // Calculate items granted with fractional accumulation
    const { itemsGranted, newAccumulated } = calculateItemsGranted(
      effectiveItemsPerHour,
      runtimeMinutes,
      state.bot_accumulated_progress || 0
    );

    if (itemsGranted === 0) {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          bot_running_until: null,
          bot_accumulated_progress: newAccumulated,
        })
        .eq('id', this.userId);

      if (error) {
        return {
          success: false,
          session_started: false,
          session_ended: false,
          error: 'Failed to complete session',
        };
      }

      return {
        success: true,
        session_started: false,
        session_ended: true,
        items_granted: 0,
      };
    }

    // Get all items with their rarities and power values
    const { data: allItems } = await this.supabase
      .from('items')
      .select('id, name, rarity, score_value');

    if (!allItems || allItems.length === 0) {
      return {
        success: false,
        session_started: false,
        session_ended: false,
        error: 'No items available in the system',
      };
    }

    // Define rarity weights (Common is most likely, Mythic is extremely rare)
    // Exponential drop-off: Common = 100,000x more likely than Mythic
    const rarityWeights: Record<string, number> = {
      'Common': 1000,
      'Uncommon': 300,
      'Rare': 50,
      'Epic': 10,
      'Legendary': 2,
      'Mythic': 0.01,
    };

    // Calculate satellite bonus for rare drops (increases chance of higher rarities)
    const satelliteBonus = state.satellite_level * 0.03; // 0.03% per level
    const adjustedWeights = { ...rarityWeights };
    
    // Shift some weight from Common to higher rarities based on satellite level
    if (satelliteBonus > 0) {
      const bonusShift = Math.min(satelliteBonus / 100, 0.2); // Max 20% shift
      adjustedWeights['Common'] = Math.max(1, rarityWeights['Common'] * (1 - bonusShift));
      adjustedWeights['Uncommon'] = rarityWeights['Uncommon'] * (1 + bonusShift * 0.3);
      adjustedWeights['Rare'] = rarityWeights['Rare'] * (1 + bonusShift * 0.5);
      adjustedWeights['Epic'] = rarityWeights['Epic'] * (1 + bonusShift * 0.7);
      adjustedWeights['Legendary'] = rarityWeights['Legendary'] * (1 + bonusShift * 0.9);
      adjustedWeights['Mythic'] = rarityWeights['Mythic'] * (1 + bonusShift);
    }

    // Group items by rarity
    const itemsByRarity: Record<string, typeof allItems> = {};
    for (const item of allItems) {
      if (!itemsByRarity[item.rarity]) {
        itemsByRarity[item.rarity] = [];
      }
      itemsByRarity[item.rarity].push(item);
    }

    // Weighted random selection function
    const selectRandomItem = (): typeof allItems[0] => {
      const rarities = Object.keys(adjustedWeights);
      const totalWeight = rarities.reduce((sum, r) => sum + (adjustedWeights[r] || 0), 0);
      let random = Math.random() * totalWeight;
      
      for (const rarity of rarities) {
        random -= adjustedWeights[rarity] || 0;
        if (random <= 0) {
          const itemsOfRarity = itemsByRarity[rarity];
          if (itemsOfRarity && itemsOfRarity.length > 0) {
            return itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
          }
        }
      }
      
      // Fallback to random item
      return allItems[Math.floor(Math.random() * allItems.length)];
    };

    // Select items with weighted random
    const grantedItems: typeof allItems = [];
    for (let i = 0; i < itemsGranted; i++) {
      grantedItems.push(selectRandomItem());
    }

    // Calculate total power gained from items
    let totalPowerGained = 0;
    for (const item of grantedItems) {
      totalPowerGained += item.score_value || 0;
    }

    // Update inventory JSON - add granted items
    const newInventory = { ...state.inventory };
    const newCollectionHistory = { ...state.collection_history };
    
    for (const item of grantedItems) {
      // Add to current inventory
      newInventory[item.id] = (newInventory[item.id] || 0) + 1;
      // Add to collection history (track total collected)
      newCollectionHistory[item.id] = (newCollectionHistory[item.id] || 0) + 1;
    }

    // Calculate new totals
    const newTotalPower = state.total_power + totalPowerGained;
    const newMonthlyPower = state.monthly_power_gain + totalPowerGained;
    const newTotalItems = state.total_items_collected + itemsGranted;
    const newCurrentItems = state.current_items_owned + itemsGranted;

    // Update all counters atomically
    const { error } = await this.supabase
      .from('profiles')
      .update({
        bot_running_until: null,
        bot_session_runtime_minutes: null,
        bot_accumulated_progress: newAccumulated,
        total_items_collected: newTotalItems,
        current_items_owned: newCurrentItems,
        total_power: newTotalPower,
        monthly_power_gain: newMonthlyPower,
        inventory: newInventory,
        collection_history: newCollectionHistory,
      })
      .eq('id', this.userId);

    if (error) {
      return {
        success: false,
        session_started: false,
        session_ended: false,
        error: 'Failed to collect items',
      };
    }

    // Prepare items received for response
    const itemsReceived = grantedItems.map((item: { id: string; name?: string; rarity?: string; score_value?: number }) => ({
      id: item.id,
      name: item.name || 'Unknown Item',
      rarity: item.rarity || 'Common',
      score_value: item.score_value || 0,
    }));

    return {
      success: true,
      session_started: false,
      session_ended: true,
      items_granted: itemsGranted,
      total_power_gained: totalPowerGained,
      items_received: itemsReceived,
      updated_state: {
        total_items_collected: newTotalItems,
        current_items_owned: newCurrentItems,
        total_power: newTotalPower,
        monthly_power_gain: newMonthlyPower,
        bot_running_until: null,
        bot_accumulated_progress: newAccumulated,
        inventory: newInventory,
        collection_history: newCollectionHistory,
      },
    };
  }

  /**
   * Get user state with economy fields
   */
  private async getUserState(): Promise<UserEconomyState> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id,
        token_balance,
        total_items_collected,
        current_items_owned,
        total_power,
        monthly_power_gain,
        bot_accumulated_progress,
        bot_running_until,
        bot_session_runtime_minutes,
        last_free_run_at,
        subscription_expiry,
        owned_ticket_ids,
        inventory,
        collection_history,
        bot_items_per_hour_level,
        bot_runtime_level,
        satellite_level,
        cost_per_hour_level
      `)
      .eq('id', this.userId)
      .single();

    if (error || !data) {
      return {
        cost_per_hour_level: 0,
        token_balance: 0,
        total_items_collected: 0,
        current_items_owned: 0,
        total_power: 0,
        monthly_power_gain: 0,
        bot_accumulated_progress: 0,
        bot_running_until: null,
        bot_session_runtime_minutes: null,
        last_free_run_at: null,
        subscription_expiry: null,
        bot_items_per_hour_level: 0,
        bot_runtime_level: 0,
        satellite_level: 0,
        owned_ticket_ids: [],
        inventory: {},
        collection_history: {},
      };
    }

    let owned_ticket_ids: string[] = [];
    if (data.owned_ticket_ids) {
      if (typeof data.owned_ticket_ids === 'string') {
        try {
          owned_ticket_ids = JSON.parse(data.owned_ticket_ids);
        } catch {
          owned_ticket_ids = [];
        }
      } else if (Array.isArray(data.owned_ticket_ids)) {
        owned_ticket_ids = data.owned_ticket_ids;
      }
    }

    return {
      cost_per_hour_level: data.cost_per_hour_level || 0,
      token_balance: data.token_balance || 0,
      total_items_collected: data.total_items_collected || 0,
      current_items_owned: data.current_items_owned || 0,
      total_power: data.total_power || 0,
      monthly_power_gain: data.monthly_power_gain || 0,
      bot_accumulated_progress: data.bot_accumulated_progress || 0,
      bot_running_until: data.bot_running_until || null,
      bot_session_runtime_minutes: data.bot_session_runtime_minutes || null,
      last_free_run_at: data.last_free_run_at || null,
      subscription_expiry: data.subscription_expiry || null,
      bot_items_per_hour_level: data.bot_items_per_hour_level || 0,
      bot_runtime_level: data.bot_runtime_level || 0,
      satellite_level: data.satellite_level || 0,
      owned_ticket_ids,
      inventory: data.inventory || {},
      collection_history: data.collection_history || {},
    };
  }
}

/**
 * Factory function
 */
export function createHuntBotService(supabaseClient: any, userId: string): HuntBotService {
  return new HuntBotService(supabaseClient, userId);
}
