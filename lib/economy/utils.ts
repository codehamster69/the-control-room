/**
 * ECONOMY SYSTEM UTILITIES
 * 
 * Helper functions for economy calculations.
 * All functions use integer math where applicable.
 */

import {
  BOT_UPGRADE_BASE_COST,
  BOT_UPGRADE_GROWTH_RATE,
  RUNTIME_UPGRADE_BASE_COST,
  RUNTIME_UPGRADE_GROWTH,
  SATELLITE_BASE_COST,
  SATELLITE_GROWTH_RATE,
  SATELLITE_INCREMENT_BP,
  BASE_ITEMS_PER_HOUR,
  BASE_COST_PER_HOUR,
  BASE_RUNTIME_MINUTES,
  RUNTIME_GROWTH_RATE,
  MAX_RUNTIME_MINUTES,
  SELL_VALUE_PER_ITEM,
  FREE_RUN_DURATION_MINUTES,
  FREE_RUN_COOLDOWN_HOURS,
  MARKETPLACE_BURN_RATE_BP,
  MAX_ITEMS_PER_HOUR,
  MAX_SATELLITE_LEVEL,
  COST_PER_HOUR_UPGRADE_BASE_COST,
  COST_PER_HOUR_UPGRADE_GROWTH_RATE,
  MIN_COST_PER_HOUR,
  MAX_COST_PER_HOUR_LEVEL,
} from './constants';

/**
 * Calculate bot upgrade cost
 * Formula: base_cost * (growth_rate ^ level)
 * Returns integer (floored)
 */
export function calculateBotUpgradeCost(level: number): number {
  const cost = BOT_UPGRADE_BASE_COST * Math.pow(BOT_UPGRADE_GROWTH_RATE, level);
  return Math.floor(cost);
}

/**
 * Calculate runtime upgrade cost
 * Formula: base_cost * (growth_rate ^ level)
 * Returns integer (floored)
 */
export function calculateRuntimeUpgradeCost(level: number): number {
  const cost = RUNTIME_UPGRADE_BASE_COST * Math.pow(RUNTIME_UPGRADE_GROWTH, level);
  return Math.floor(cost);
}

/**
 * Calculate satellite upgrade cost
 * Formula: base_cost * (growth_rate ^ level)
 * Returns integer (floored)
 */
export function calculateSatelliteUpgradeCost(level: number): number {
  const cost = SATELLITE_BASE_COST * Math.pow(SATELLITE_GROWTH_RATE, level);
  return Math.floor(cost);
}

/**
 * Calculate cost per hour upgrade cost
 * Formula: base_cost * (growth_rate ^ level)
 * Returns integer (floored)
 */
export function calculateCostPerHourUpgradeCost(level: number): number {
  const cost = COST_PER_HOUR_UPGRADE_BASE_COST * Math.pow(COST_PER_HOUR_UPGRADE_GROWTH_RATE, level);
  return Math.floor(cost);
}

/**
 * Calculate effective cost per hour
 * Formula: max(MIN, BASE - (level * reduction_per_level))
 * Reduction: 0.6 tokens per level (60 tokens over 100 levels)
 */
export function calculateCostPerHour(level: number): number {
  const reductionPerLevel = (BASE_COST_PER_HOUR - MIN_COST_PER_HOUR) / MAX_COST_PER_HOUR_LEVEL; // 0.6 per level
  const cost = BASE_COST_PER_HOUR - (level * reductionPerLevel);
  return Math.max(MIN_COST_PER_HOUR, Math.floor(cost));
}

/**
 * Calculate effective items per hour
 * Formula: min(MAX, BASE + (level * 1))
 */
export function calculateItemsPerHour(level: number): number {
  const itemsPerHour = BASE_ITEMS_PER_HOUR + (level * 1);
  return Math.min(MAX_ITEMS_PER_HOUR, itemsPerHour);
}

/**
 * Calculate max runtime in minutes
 * Formula: min(1440, floor(BASE * (growth_rate ^ level)))
 */
export function calculateMaxRuntimeMinutes(level: number): number {
  const runtime = BASE_RUNTIME_MINUTES * Math.pow(RUNTIME_GROWTH_RATE, level);
  return Math.min(MAX_RUNTIME_MINUTES, Math.floor(runtime));
}

/**
 * Calculate satellite bonus in basis points
 * Formula: min(MAX, level * increment_bp)
 */
export function calculateSatelliteBonusBp(level: number): number {
  const bonusBp = level * SATELLITE_INCREMENT_BP;
  return Math.min(MAX_SATELLITE_LEVEL * SATELLITE_INCREMENT_BP, bonusBp);
}

/**
 * Calculate satellite bonus as percentage string
 */
export function getSatelliteBonusPercent(level: number): string {
  const bp = calculateSatelliteBonusBp(level);
  return (bp / 100).toFixed(2);
}

/**
 * Calculate runtime cost
 * Cost per minute * runtime_minutes
 */
export function calculateRuntimeCost(runtimeMinutes: number): number {
  return runtimeMinutes;
}

/**
 * Calculate tokens earned from selling items
 * Formula: items * sell_value_per_item
 */
export function calculateSellValue(items: number): number {
  return items * SELL_VALUE_PER_ITEM;
}

/**
 * Calculate marketplace burn amount
 * Formula: floor(price * burn_rate_bp / 10000)
 */
export function calculateMarketplaceBurn(price: number): number {
  return Math.floor((price * MARKETPLACE_BURN_RATE_BP) / 10000);
}

/**
 * Calculate seller receive amount after burn
 * Formula: price - burn_amount
 */
export function calculateSellerReceive(price: number): number {
  const burn = calculateMarketplaceBurn(price);
  return price - burn;
}

/**
 * Calculate items generated from bot run
 * Uses fractional accumulation
 * 
 * Formula:
 * items_generated_raw = (effective_items_per_hour / 60) * minutes_run
 * total_progress = accumulated + items_generated_raw
 * items_granted = floor(total_progress)
 * accumulated = total_progress - items_granted
 */
export function calculateItemsGranted(
  effectiveItemsPerHour: number,
  minutesRun: number,
  accumulatedProgress: number
): { itemsGranted: number; newAccumulated: number } {
  const itemsGeneratedRaw = (effectiveItemsPerHour / 60) * minutesRun;
  const totalProgress = accumulatedProgress + itemsGeneratedRaw;
  const itemsGranted = Math.floor(totalProgress);
  const newAccumulated = totalProgress - itemsGranted;
  
  return {
    itemsGranted,
    newAccumulated: Math.round(newAccumulated * 10000) / 10000, // Round to prevent floating point drift
  };
}

/**
 * Calculate bot progress percentage
 */
export function calculateBotProgressPercent(
  startedAt: number,
  runtimeMinutes: number,
  now: number
): number {
  const totalMs = runtimeMinutes * 60 * 1000;
  const elapsedMs = now - startedAt;
  const progress = elapsedMs / totalMs;
  return Math.min(100, Math.max(0, progress * 100));
}

/**
 * Calculate remaining bot time in minutes
 */
export function calculateRemainingMinutes(
  startedAt: number,
  runtimeMinutes: number,
  now: number
): number {
  const endTime = startedAt + (runtimeMinutes * 60 * 1000);
  const remainingMs = endTime - now;
  return Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
}

/**
 * Check if free run cooldown has expired
 */
export function isFreeRunCooldownExpired(lastFreeRunAt: number | null): boolean {
  if (!lastFreeRunAt) return true;
  
  const cooldownMs = FREE_RUN_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  return (now - lastFreeRunAt) >= cooldownMs;
}

/**
 * Get free run cooldown remaining in seconds
 */
export function getFreeRunCooldownRemaining(lastFreeRunAt: number | null): number {
  if (!lastFreeRunAt) return 0;
  
  const cooldownMs = FREE_RUN_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const remaining = cooldownMs - (now - lastFreeRunAt);
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Format cooldown seconds to HH:MM:SS
 */
export function formatCooldown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(expiry: number | null): boolean {
  if (!expiry) return false;
  return Date.now() < expiry;
}

/**
 * Get subscription days remaining
 */
export function getSubscriptionDaysRemaining(expiry: number | null): number {
  if (!expiry) return 0;
  const remainingMs = expiry - Date.now();
  return Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));
}

/**
 * Validate upgrade level bounds
 */
export function isValidBotLevel(level: number): boolean {
  return level >= 0 && level <= (MAX_ITEMS_PER_HOUR - BASE_ITEMS_PER_HOUR); // Cap at max items/hr
}

export function isValidRuntimeLevel(level: number): boolean {
  return level >= 0 && level <= 50; // Reasonable cap
}

export function isValidSatelliteLevel(level: number): boolean {
  return level >= 0 && level <= MAX_SATELLITE_LEVEL; // Cap at 1000 (30% bonus)
}

export function isValidCostPerHourLevel(level: number): boolean {
  return level >= 0 && level <= MAX_COST_PER_HOUR_LEVEL; // Cap at 100 (60 tokens/hour min)
}

/**
 * Calculate upgrade level from total investment
 * Useful for displaying "next level at X tokens"
 */
export function calculateBotLevelFromInvestment(invested: number): number {
  let level = 0;
  let totalCost = 0;
  
  while (true) {
    const nextCost = calculateBotUpgradeCost(level);
    if (totalCost + nextCost > invested) break;
    totalCost += nextCost;
    level++;
  }
  
  return level;
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Calculate economic ratio for monitoring
 */
export function calculateBurnGenerationRatio(
  burned: number,
  generated: number
): number {
  if (generated === 0) return burned === 0 ? 1 : Infinity;
  return burned / generated;
}

/**
 * Check if economic balance is within acceptable range
 */
export function isEconomicBalanceAcceptable(
  burned: number,
  generated: number,
  targetRatio: number,
  allowedVariance: number
): boolean {
  const ratio = calculateBurnGenerationRatio(burned, generated);
  
  if (ratio === Infinity) return false;
  
  const lowerBound = targetRatio * (1 - allowedVariance);
  const upperBound = targetRatio * (1 + allowedVariance);
  
  return ratio >= lowerBound && ratio <= upperBound;
}
