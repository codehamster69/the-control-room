/**
 * ECONOMY SERVICE
 * 
 * Core service for managing tokens, burns, and economic state.
 * All token calculations use integer math.
 */

import { createClient } from '@/lib/supabase/server';
import { 
  UserEconomyState, 
  EconomyMetrics,
} from '../types';
import { calculateSellValue, calculateMarketplaceBurn } from '../utils';

export class EconomyService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Get or create user economy state
   */
  async getUserEconomyState(userId: string): Promise<UserEconomyState | null> {
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
        bot_items_per_hour_level,
        bot_runtime_level,
        satellite_level,
        cost_per_hour_level,
        inventory,
        collection_history
      `)
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }
    
    if (!data) {
      return null;
    }

    // Parse owned_ticket_ids if it's a string (JSON)
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
      cost_per_hour_level: data.cost_per_hour_level || 0,
      owned_ticket_ids,
      inventory: data.inventory || {},
      collection_history: data.collection_history || {},
    };
  }

  /**
   * Update user economy state
   */
  async updateUserEconomyState(
    userId: string, 
    updates: Partial<UserEconomyState>
  ): Promise<boolean> {
    const updateData: any = { ...updates };
    
    // Ensure owned_ticket_ids is stored as JSON string if it's an array
    if (updates.owned_ticket_ids && Array.isArray(updates.owned_ticket_ids)) {
      updateData.owned_ticket_ids = JSON.stringify(updates.owned_ticket_ids);
    }

    const { error } = await this.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    return !error;
  }

  /**
   * Add tokens to user (called when items are sold)
   */
  async addTokens(userId: string, amount: number): Promise<boolean> {
    const state = await this.getUserEconomyState(userId);
    if (!state) return false;

    const newBalance = state.token_balance + amount;

    const { error } = await this.supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', userId);

    if (error) return false;

    // Track generation in metrics
    await this.trackTokenGeneration(amount);

    return true;
  }

  /**
   * Burn tokens from user (called for marketplace)
   * Returns false if insufficient balance
   */
  async burnTokens(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false;

    const { data: profile, error: fetchError } = await this.supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) return false;

    if (profile.token_balance < amount) {
      return false;
    }

    const newBalance = profile.token_balance - amount;

    const { error } = await this.supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', userId);

    if (error) return false;

    // Track burn in metrics
    await this.trackTokenBurn(amount);

    return true;
  }

  /**
   * Track token generation in global metrics
   */
  async trackTokenGeneration(amount: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { error } = await this.supabase
      .from('economy_metrics')
      .upsert({
        date: today,
        tokens_generated_today: amount,
        total_tokens_generated: amount,
      }, {
        onConflict: 'date',
        ignoreDuplicates: false
      });

  }

  /**
   * Track token burn in global metrics
   */
  async trackTokenBurn(amount: number): Promise<void> {
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

  /**
   * Get global economy metrics
   */
  async getEconomyMetrics(): Promise<EconomyMetrics | null> {
    const { data, error } = await this.supabase
      .from('economy_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      total_tokens_generated: data.total_tokens_generated || 0,
      total_tokens_burned: data.total_tokens_burned || 0,
      tokens_generated_today: data.tokens_generated_today || 0,
      tokens_burned_today: data.tokens_burned_today || 0,
      total_items_sold: data.total_items_sold || 0,
      total_items_generated: data.total_items_generated || 0,
      total_tickets_listed: data.total_tickets_listed || 0,
      total_tickets_sold: data.total_tickets_sold || 0,
      total_marketplace_volume: data.total_marketplace_volume || 0,
      current_month_start: data.current_month_start || Date.now(),
      current_month: data.current_month || this.getCurrentMonth(),
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Process item sale by quantity
   * Returns: { success, tokens_earned }
   */
  async sellItems(
    userId: string, 
    itemsToSell: number
  ): Promise<{ success: boolean; tokens_earned: number; error?: string }> {
    const state = await this.getUserEconomyState(userId);
    if (!state) {
      return { success: false, tokens_earned: 0, error: 'User not found' };
    }

    if (itemsToSell <= 0) {
      return { success: false, tokens_earned: 0, error: 'Invalid amount' };
    }

    if (itemsToSell > state.current_items_owned) {
      return { success: false, tokens_earned: 0, error: 'Not enough items' };
    }

    const tokensEarned = calculateSellValue(itemsToSell);

    const { error } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance + tokensEarned,
        current_items_owned: state.current_items_owned - itemsToSell,
      })
      .eq('id', userId)
      .eq('current_items_owned', state.current_items_owned);

    if (error) {
      return { success: false, tokens_earned: 0, error: 'Transaction failed' };
    }

    await this.trackTokenGeneration(tokensEarned);

    return { success: true, tokens_earned: tokensEarned };
  }

  /**
   * Sell specific item by ID with quantity
   * Uses item's score_value as sell price per item
   * Updates JSON inventory column
   */
  async sellItemById(
    userId: string,
    itemId: string,
    quantity: number
  ): Promise<{ success: boolean; tokens_earned: number; error?: string }> {
    // Get the item details to determine sell value
    const { data: itemData, error: itemError } = await this.supabase
      .from('items')
      .select('score_value')
      .eq('id', itemId)
      .single();

    if (itemError || !itemData) {
      return { success: false, tokens_earned: 0, error: 'Item not found' };
    }

    // Get user state with inventory
    const state = await this.getUserEconomyState(userId);
    if (!state) {
      return { success: false, tokens_earned: 0, error: 'User not found' };
    }

    // Check if item exists in inventory
    const currentQuantity = state.inventory[itemId] || 0;
    if (currentQuantity === 0) {
      return { success: false, tokens_earned: 0, error: 'Item not in inventory' };
    }

    if (quantity > currentQuantity) {
      return { success: false, tokens_earned: 0, error: 'Not enough items' };
    }

    // Calculate tokens based on item's power value
    const sellValue = itemData.score_value || 10;
    const tokensEarned = sellValue * quantity;

    // Update inventory JSON
    const newInventory = { ...state.inventory };
    const newQuantity = currentQuantity - quantity;
    if (newQuantity > 0) {
      newInventory[itemId] = newQuantity;
    } else {
      delete newInventory[itemId];
    }

    // Update user profile with new inventory and token balance
    const { error } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance + tokensEarned,
        current_items_owned: state.current_items_owned - quantity,
        inventory: newInventory,
      })
      .eq('id', userId);

    if (error) {
      return { success: false, tokens_earned: 0, error: 'Transaction failed' };
    }

    await this.trackTokenGeneration(tokensEarned);

    return { success: true, tokens_earned: tokensEarned };
  }

  /**
   * Sell items by category (specific rarity)
   * Returns breakdown of items sold and tokens earned
   * Uses JSON inventory column
   */
  async sellItemsByCategory(
    userId: string,
    category: string
  ): Promise<{
    success: boolean;
    items_sold: number;
    tokens_earned: number;
    breakdown?: { rarity: string; quantity: number; value: number }[];
    error?: string;
  }> {
    // Get user state with inventory
    const state = await this.getUserEconomyState(userId);
    if (!state) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'User not found' };
    }

    // Get all items to check rarities
    const { data: allItems, error: itemsError } = await this.supabase
      .from('items')
      .select('id, name, rarity, score_value');

    if (itemsError || !allItems) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'Failed to load items' };
    }

    // Find items in inventory that match the category
    const itemsToSell: { itemId: string; quantity: number; item: any }[] = [];
    
    for (const [itemId, quantity] of Object.entries(state.inventory)) {
      const item = allItems.find((i: any) => i.id === itemId);
      if (item && item.rarity && item.rarity.toLowerCase() === category.toLowerCase()) {
        itemsToSell.push({ itemId, quantity, item });
      }
    }

    if (itemsToSell.length === 0) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: `No ${category} items found` };
    }

    let totalItems = 0;
    let totalTokens = 0;
    const breakdown: { rarity: string; quantity: number; value: number }[] = [];

    for (const { item, quantity } of itemsToSell) {
      // Use each item's score_value instead of fixed sell value
      const itemValue = item.score_value || 10;
      const value = itemValue * quantity;
      
      totalItems += quantity;
      totalTokens += value;
      
      breakdown.push({
        rarity: item.rarity,
        quantity,
        value,
      });
    }

    // Remove the check since we're getting items from inventory JSON which is the source of truth
    // Update inventory JSON - remove sold items
    const newInventory = { ...state.inventory };
    for (const { itemId } of itemsToSell) {
      delete newInventory[itemId];
    }

    const { error } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance + totalTokens,
        current_items_owned: state.current_items_owned - totalItems,
        inventory: newInventory,
      })
      .eq('id', userId);

    if (error) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'Transaction failed' };
    }

    await this.trackTokenGeneration(totalTokens);

    return {
      success: true,
      items_sold: totalItems,
      tokens_earned: totalTokens,
      breakdown,
    };
  }

  /**
   * Sell all items at once
   * Returns breakdown by category
   * Uses JSON inventory column
   */
  async sellAllItems(
    userId: string
  ): Promise<{
    success: boolean;
    items_sold: number;
    tokens_earned: number;
    breakdown?: { rarity: string; quantity: number; value: number }[];
    error?: string;
  }> {
    // Get user state with inventory
    const state = await this.getUserEconomyState(userId);
    if (!state) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'User not found' };
    }

    const inventoryEntries = Object.entries(state.inventory);
    if (inventoryEntries.length === 0) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'No items to sell' };
    }

    // Get all items to check rarities
    const { data: allItems, error: itemsError } = await this.supabase
      .from('items')
      .select('id, name, rarity, score_value');

    if (itemsError || !allItems) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'Failed to load items' };
    }

    let totalItems = 0;
    let totalTokens = 0;
    const breakdownMap = new Map<string, { quantity: number; value: number }>();

    for (const [itemId, quantity] of inventoryEntries) {
      const item = allItems.find((i: any) => i.id === itemId);
      // Use each item's score_value instead of fixed sell value
      const itemValue = item?.score_value || 10;
      const value = itemValue * quantity;
      
      totalItems += quantity;
      totalTokens += value;
      
      const rarity = item?.rarity || 'Unknown';
      const existing = breakdownMap.get(rarity) || { quantity: 0, value: 0 };
      breakdownMap.set(rarity, {
        quantity: existing.quantity + quantity,
        value: existing.value + value,
      });
    }

    // Remove the check since we're getting items from inventory JSON which is the source of truth
    // Clear inventory JSON
    const { error } = await this.supabase
      .from('profiles')
      .update({
        token_balance: state.token_balance + totalTokens,
        current_items_owned: 0,
        inventory: {},
      })
      .eq('id', userId);

    if (error) {
      return { success: false, items_sold: 0, tokens_earned: 0, error: 'Transaction failed' };
    }

    await this.trackTokenGeneration(totalTokens);

    const breakdown = Array.from(breakdownMap.entries()).map(([rarity, data]) => ({
      rarity,
      quantity: data.quantity,
      value: data.value,
    }));

    return {
      success: true,
      items_sold: totalItems,
      tokens_earned: totalTokens,
      breakdown,
    };
  }

  /**
   * Get user's inventory with category breakdown
   * Uses JSON inventory column
   */
  async getInventoryBreakdown(userId: string): Promise<{
    total_items: number;
    by_category: { rarity: string; quantity: number }[];
    details: { id: string; name: string; rarity: string; description?: string; quantity: number }[];
  }> {
    // Get user state with inventory
    const state = await this.getUserEconomyState(userId);
    if (!state) {
      return { total_items: 0, by_category: [], details: [] };
    }

    // Get all items to check rarities and details
    const { data: allItems, error } = await this.supabase
      .from('items')
      .select('id, name, rarity, description, score_value');

    if (error || !allItems) {
      return { total_items: 0, by_category: [], details: [] };
    }

    const categoryMap = new Map<string, number>();
    let totalItems = 0;
    const details: { id: string; name: string; rarity: string; description?: string; quantity: number }[] = [];

    for (const [itemId, quantity] of Object.entries(state.inventory)) {
      const item = allItems.find((i: any) => i.id === itemId);
      if (!item) continue;
      
      const rarity = item.rarity || 'Unknown';
      const existing = categoryMap.get(rarity) || 0;
      categoryMap.set(rarity, existing + quantity);
      totalItems += quantity;
      
      details.push({
        id: item.id,
        name: item.name,
        rarity,
        description: item.description,
        quantity,
      });
    }

    const byCategory = Array.from(categoryMap.entries()).map(([rarity, quantity]) => ({
      rarity,
      quantity,
    }));

    return { total_items: totalItems, by_category: byCategory, details };
  }

  /**
   * Calculate marketplace transaction with burn
   */
  calculateMarketplaceTransaction(price: number): {
    burn_amount: number;
    seller_receives: number;
  } {
    const burnAmount = calculateMarketplaceBurn(price);
    const sellerReceives = price - burnAmount;
    
    return {
      burn_amount: burnAmount,
      seller_receives: sellerReceives,
    };
  }
}

/**
 * Factory function to create economy service
 */
export function createEconomyService(supabaseClient?: any): EconomyService {
  if (!supabaseClient) {
    throw new Error('Supabase client required');
  }
  return new EconomyService(supabaseClient);
}
