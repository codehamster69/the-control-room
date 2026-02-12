/**
 * LEADERBOARD SERVICE
 * 
 * Handles global and monthly leaderboards.
 * Monthly resets on 1st of each month.
 * Global leaderboard never resets.
 */

import { createClient } from '@/lib/supabase/server';
import { 
  LeaderboardEntry,
  EconomyMetrics,
} from '../types';

export class LeaderboardService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Get current month string (YYYY-MM)
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get month start timestamp (1st of current month at 00:00 UTC)
   */
  private getMonthStartTimestamp(): number {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)).getTime();
  }

  // Note: Monthly reset is handled by a cron job in the Supabase database schema
  // No need to check/perform reset in application code

  /**
   * Get global leaderboard (all-time, never resets)
   */
  async getGlobalLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id,
        instagram_username,
        avatar_url,
        total_power,
        total_items_collected
      `)
      .eq('is_instagram_verified', true)
      .order('total_power', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((profile: any, index: number) => ({
      rank: index + 1,
      user_id: profile.id,
      username: profile.instagram_username || 'Unknown',
      avatar_url: profile.avatar_url || undefined,
      power: profile.total_power || 0,
      items_collected: profile.total_items_collected || 0,
    }));
  }

  /**
   * Get monthly leaderboard (resets 1st of month via database cron job)
   */
  async getMonthlyLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id,
        instagram_username,
        avatar_url,
        monthly_power_gain,
        total_items_collected
      `)
      .eq('is_instagram_verified', true)
      .order('monthly_power_gain', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return (data || []).map((profile: any, index: number) => ({
      rank: index + 1,
      user_id: profile.id,
      username: profile.instagram_username || 'Unknown',
      avatar_url: profile.avatar_url || undefined,
      power: profile.monthly_power_gain || 0,
      items_collected: profile.total_items_collected || 0,
    }));
  }

  /**
   * Get user's rank on global leaderboard
   */
  async getGlobalRank(userId: string): Promise<number | null> {
    // Get user's power
    const { data: user } = await this.supabase
      .from('profiles')
      .select('total_power')
      .eq('id', userId)
      .single();

    if (!user) return null;

    // Count verified users with higher power
    const { count } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_instagram_verified', true)
      .gt('total_power', user.total_power || 0);

    return count !== null ? count + 1 : null;
  }

  /**
   * Get user's rank on monthly leaderboard
   */
  async getMonthlyRank(userId: string): Promise<number | null> {
    // Get user's monthly power
    const { data: user, error: userError } = await this.supabase
      .from('profiles')
      .select('monthly_power_gain')
      .eq('id', userId)
      .single();

    if (userError || !user) return null;

    // Count verified users with higher monthly power
    const { count, error: countError } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_instagram_verified', true)
      .gt('monthly_power_gain', user.monthly_power_gain || 0);

    return count !== null ? count + 1 : null;
  }

  /**
   * Get leaderboard data for status endpoint
   */
  async getLeaderboardData(userId: string): Promise<{
    monthlyRank: number | null;
    monthlyTop: LeaderboardEntry[];
    globalRank: number | null;
    globalTop: LeaderboardEntry[];
  }> {
    const [monthlyRank, monthlyTop, globalRank, globalTop] = await Promise.all([
      this.getMonthlyRank(userId),
      this.getMonthlyLeaderboard(10),
      this.getGlobalRank(userId),
      this.getGlobalLeaderboard(10),
    ]);

    return {
      monthlyRank,
      monthlyTop,
      globalRank,
      globalTop,
    };
  }
}

/**
 * Factory function
 */
export function createLeaderboardService(supabaseClient?: any): LeaderboardService {
  if (!supabaseClient) {
    throw new Error('Supabase client required');
  }
  return new LeaderboardService(supabaseClient);
}
