/**
 * UPGRADE SERVICE
 * 
 * Handles bot, runtime, satellite, and cost per hour upgrades.
 * All upgrades burn tokens.
 */

import { createClient } from '@/lib/supabase/server';
import {
  UserEconomyState,
  UpgradeResult,
} from '../types';
import {
  calculateBotUpgradeCost,
  calculateRuntimeUpgradeCost,
  calculateSatelliteUpgradeCost,
  calculateCostPerHourUpgradeCost,
  calculateItemsPerHour,
  calculateMaxRuntimeMinutes,
  calculateSatelliteBonusBp,
  calculateCostPerHour,
} from '../utils';
import { 
  BASE_COST_PER_HOUR,
  BASE_ITEMS_PER_HOUR,
  MAX_ITEMS_PER_HOUR,
  MAX_RUNTIME_MINUTES,
  MAX_SATELLITE_LEVEL,
  MIN_COST_PER_HOUR,
  MAX_COST_PER_HOUR_LEVEL,
  MAX_RUNTIME_LEVEL,
  MAX_BOT_LEVEL,
} from '../constants';

export class UpgradeService {
  private supabase: any;
  private userId: string;

  constructor(supabaseClient: any, userId: string) {
    this.supabase = supabaseClient;
    this.userId = userId;
  }

  /**
   * Get current upgrade levels and costs
   */
  async getUpgradeStatus(): Promise<{
    bot_level: number;
    bot_max_level: number;
    bot_upgrade_cost: number;
    bot_items_per_hour: number;
    bot_cost_per_hour: number;
    bot_progress_percent: number;
    
    runtime_level: number;
    runtime_max_level: number;
    runtime_upgrade_cost: number;
    max_runtime_minutes: number;
    runtime_progress_percent: number;
    
    satellite_level: number;
    satellite_max_level: number;
    satellite_upgrade_cost: number;
    satellite_bonus_bp: number;
    satellite_progress_percent: number;
    
    cost_per_hour_level: number;
    cost_per_hour_max_level: number;
    cost_per_hour_upgrade_cost: number;
    cost_per_hour_current: number;
    cost_per_hour_progress_percent: number;
    
    token_balance: number;
  }> {
    const state = await this.getUserState();

    // Calculate max levels
    const botMaxLevel = MAX_BOT_LEVEL; // 45 levels (15 to 60 items/hr)
    const runtimeMaxLevel = MAX_RUNTIME_LEVEL; // 100 levels (reaches 24 hours)
    const satelliteMaxLevel = MAX_SATELLITE_LEVEL; // 1000
    const costPerHourMaxLevel = MAX_COST_PER_HOUR_LEVEL; // 100

    // Calculate progress percentages
    const botProgress = Math.min(100, Math.round((state.bot_items_per_hour_level / botMaxLevel) * 100));
    const runtimeProgress = Math.min(100, Math.round((state.bot_runtime_level / runtimeMaxLevel) * 100));
    const satelliteProgress = Math.min(100, Math.round((state.satellite_level / satelliteMaxLevel) * 100));
    const costPerHourProgress = Math.min(100, Math.round((state.cost_per_hour_level / costPerHourMaxLevel) * 100));

    return {
      bot_level: state.bot_items_per_hour_level,
      bot_max_level: botMaxLevel,
      bot_upgrade_cost: calculateBotUpgradeCost(state.bot_items_per_hour_level),
      bot_items_per_hour: calculateItemsPerHour(state.bot_items_per_hour_level),
      bot_cost_per_hour: BASE_COST_PER_HOUR,
      bot_progress_percent: botProgress,
      
      runtime_level: state.bot_runtime_level,
      runtime_max_level: runtimeMaxLevel,
      runtime_upgrade_cost: calculateRuntimeUpgradeCost(state.bot_runtime_level),
      max_runtime_minutes: calculateMaxRuntimeMinutes(state.bot_runtime_level),
      runtime_progress_percent: runtimeProgress,
      
      satellite_level: state.satellite_level,
      satellite_max_level: satelliteMaxLevel,
      satellite_upgrade_cost: calculateSatelliteUpgradeCost(state.satellite_level),
      satellite_bonus_bp: calculateSatelliteBonusBp(state.satellite_level),
      satellite_progress_percent: satelliteProgress,
      
      cost_per_hour_level: state.cost_per_hour_level,
      cost_per_hour_max_level: costPerHourMaxLevel,
      cost_per_hour_upgrade_cost: calculateCostPerHourUpgradeCost(state.cost_per_hour_level),
      cost_per_hour_current: calculateCostPerHour(state.cost_per_hour_level),
      cost_per_hour_progress_percent: costPerHourProgress,
      
      token_balance: state.token_balance,
    };
  }

  /**
   * Upgrade bot efficiency
   * Burns tokens to increase items per hour
   */
  async upgradeBot(): Promise<UpgradeResult> {
    const state = await this.getUserState();
    
    // Check if already at max level
    const currentItemsPerHour = calculateItemsPerHour(state.bot_items_per_hour_level);
    if (currentItemsPerHour >= MAX_ITEMS_PER_HOUR) {
      return {
        success: false,
        upgrade_type: 'bot',
        tokens_spent: 0,
        error: `Maximum bot speed reached (${MAX_ITEMS_PER_HOUR} items/hour).`,
      };
    }
    
    const newLevel = state.bot_items_per_hour_level + 1;
    const upgradeCost = calculateBotUpgradeCost(state.bot_items_per_hour_level);

    // Validate balance
    if (state.token_balance < upgradeCost) {
      return {
        success: false,
        upgrade_type: 'bot',
        tokens_spent: 0,
        error: `Insufficient tokens. Need ${upgradeCost} tokens.`,
      };
    }

    // Deduct tokens atomically
    const { error: deductError } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance - upgradeCost,
        bot_items_per_hour_level: newLevel,
      })
      .eq('id', this.userId)
      .eq('token_balance', state.token_balance)
      .eq('bot_items_per_hour_level', state.bot_items_per_hour_level);

    if (deductError) {
      return {
        success: false,
        upgrade_type: 'bot',
        tokens_spent: 0,
        error: 'Upgrade failed. Please try again.',
      };
    }

    // Track burn
    await this.trackTokenBurn(upgradeCost);

    return {
      success: true,
      upgrade_type: 'bot',
      new_level: newLevel,
      tokens_spent: upgradeCost,
      updated_state: {
        token_balance: state.token_balance - upgradeCost,
        bot_items_per_hour_level: newLevel,
      },
    };
  }

  /**
   * Upgrade max runtime
   * Burns tokens to increase max runtime (up to 24 hours)
   */
  async upgradeRuntime(): Promise<UpgradeResult> {
    const state = await this.getUserState();
    
    // Check if already at max runtime
    const currentMaxRuntime = calculateMaxRuntimeMinutes(state.bot_runtime_level);
    if (currentMaxRuntime >= MAX_RUNTIME_MINUTES) {
      return {
        success: false,
        upgrade_type: 'runtime',
        tokens_spent: 0,
        error: `Maximum runtime reached (${MAX_RUNTIME_MINUTES} minutes = 24 hours).`,
      };
    }
    
    const newLevel = state.bot_runtime_level + 1;
    const upgradeCost = calculateRuntimeUpgradeCost(state.bot_runtime_level);

    // Validate balance
    if (state.token_balance < upgradeCost) {
      return {
        success: false,
        upgrade_type: 'runtime',
        tokens_spent: 0,
        error: `Insufficient tokens. Need ${upgradeCost} tokens.`,
      };
    }

    // Deduct tokens atomically
    const { error: deductError } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance - upgradeCost,
        bot_runtime_level: newLevel,
      })
      .eq('id', this.userId)
      .eq('token_balance', state.token_balance)
      .eq('bot_runtime_level', state.bot_runtime_level);

    if (deductError) {
      return {
        success: false,
        upgrade_type: 'runtime',
        tokens_spent: 0,
        error: 'Upgrade failed. Please try again.',
      };
    }

    // Track burn
    await this.trackTokenBurn(upgradeCost);

    return {
      success: true,
      upgrade_type: 'runtime',
      new_level: newLevel,
      tokens_spent: upgradeCost,
      updated_state: {
        token_balance: state.token_balance - upgradeCost,
        bot_runtime_level: newLevel,
      },
    };
  }

  /**
   * Upgrade satellite
   * Burns tokens to increase rare item drop chance
   */
  async upgradeSatellite(): Promise<UpgradeResult> {
    const state = await this.getUserState();
    
    // Check if already at max level
    if (state.satellite_level >= MAX_SATELLITE_LEVEL) {
      return {
        success: false,
        upgrade_type: 'satellite',
        tokens_spent: 0,
        error: `Maximum satellite level reached (${MAX_SATELLITE_LEVEL} = ${(MAX_SATELLITE_LEVEL * 10 / 100).toFixed(1)}% rare drop bonus).`,
      };
    }
    
    const newLevel = state.satellite_level + 1;
    const upgradeCost = calculateSatelliteUpgradeCost(state.satellite_level);

    // Validate balance
    if (state.token_balance < upgradeCost) {
      return {
        success: false,
        upgrade_type: 'satellite',
        tokens_spent: 0,
        error: `Insufficient tokens. Need ${upgradeCost} tokens.`,
      };
    }

    // Deduct tokens atomically
    const { error: deductError } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance - upgradeCost,
        satellite_level: newLevel,
      })
      .eq('id', this.userId)
      .eq('token_balance', state.token_balance)
      .eq('satellite_level', state.satellite_level);

    if (deductError) {
      return {
        success: false,
        upgrade_type: 'satellite',
        tokens_spent: 0,
        error: 'Upgrade failed. Please try again.',
      };
    }

    // Track burn
    await this.trackTokenBurn(upgradeCost);

    return {
      success: true,
      upgrade_type: 'satellite',
      new_level: newLevel,
      tokens_spent: upgradeCost,
      updated_state: {
        token_balance: state.token_balance - upgradeCost,
        satellite_level: newLevel,
      },
    };
  }

  /**
   * Upgrade cost per hour
   * Burns tokens to reduce hunt cost per hour (from 120 to 60 tokens/hour)
   */
  async upgradeCostPerHour(): Promise<UpgradeResult> {
    const state = await this.getUserState();
    
    // Check if already at max level
    const currentCostPerHour = calculateCostPerHour(state.cost_per_hour_level);
    if (currentCostPerHour <= MIN_COST_PER_HOUR) {
      return {
        success: false,
        upgrade_type: 'cost',
        tokens_spent: 0,
        error: `Minimum cost per hour reached (${MIN_COST_PER_HOUR} tokens/hour).`,
      };
    }
    
    const newLevel = state.cost_per_hour_level + 1;
    const upgradeCost = calculateCostPerHourUpgradeCost(state.cost_per_hour_level);

    // Validate balance
    if (state.token_balance < upgradeCost) {
      return {
        success: false,
        upgrade_type: 'cost',
        tokens_spent: 0,
        error: `Insufficient tokens. Need ${upgradeCost} tokens.`,
      };
    }

    // Deduct tokens atomically
    const { error: deductError } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance - upgradeCost,
        cost_per_hour_level: newLevel,
      })
      .eq('id', this.userId)
      .eq('token_balance', state.token_balance)
      .eq('cost_per_hour_level', state.cost_per_hour_level);

    if (deductError) {
      return {
        success: false,
        upgrade_type: 'cost',
        tokens_spent: 0,
        error: 'Upgrade failed. Please try again.',
      };
    }

    // Track burn
    await this.trackTokenBurn(upgradeCost);

    return {
      success: true,
      upgrade_type: 'cost',
      new_level: newLevel,
      tokens_spent: upgradeCost,
      updated_state: {
        token_balance: state.token_balance - upgradeCost,
        cost_per_hour_level: newLevel,
      },
    };
  }

  /**
   * Get user state
   */
  private async getUserState(): Promise<UserEconomyState> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id,
        token_balance,
        bot_items_per_hour_level,
        bot_runtime_level,
        satellite_level,
        cost_per_hour_level,
        inventory,
        collection_history
      `)
      .eq('id', this.userId)
      .single();

    if (error || !data) {
      return {
        token_balance: 0,
        total_items_collected: 0,
        current_items_owned: 0,
        total_power: 0,
        monthly_power_gain: 0,
        bot_items_per_hour_level: 0,
        bot_runtime_level: 0,
        bot_accumulated_progress: 0,
        bot_running_until: null,
        bot_session_runtime_minutes: null,
        last_free_run_at: null,
        subscription_expiry: null,
        satellite_level: 0,
        cost_per_hour_level: 0,
        owned_ticket_ids: [],
        inventory: {},
        collection_history: {},
      };
    }

    return {
      token_balance: data.token_balance || 0,
      total_items_collected: 0,
      current_items_owned: 0,
      total_power: 0,
      monthly_power_gain: 0,
      bot_items_per_hour_level: data.bot_items_per_hour_level || 0,
      bot_runtime_level: data.bot_runtime_level || 0,
      bot_accumulated_progress: 0,
      bot_running_until: null,
      bot_session_runtime_minutes: null,
      last_free_run_at: null,
      subscription_expiry: null,
      satellite_level: data.satellite_level || 0,
      cost_per_hour_level: data.cost_per_hour_level || 0,
      owned_ticket_ids: [],
      inventory: data.inventory || {},
      collection_history: data.collection_history || {},
    };
  }

  /**
   * Track token burn
   */
  private async trackTokenBurn(amount: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { error } = await this.supabase
      .from('economy_metrics')
      .upsert({
        date: today,
        tokens_burned_today: amount,
        total_tokens_burned: amount,
      }, {
        onConflict: 'date',
        ignoreDuplicates: false
      });

  }
}

/**
 * Factory function
 */
export function createUpgradeService(supabaseClient: any, userId: string): UpgradeService {
  return new UpgradeService(supabaseClient, userId);
}
