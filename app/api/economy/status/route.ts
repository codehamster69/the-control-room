/**
 * ECONOMY STATUS API
 * GET /api/economy/status
 */

import { createClient } from '@/lib/supabase/server';
import { createHuntBotService } from '@/lib/economy/services/hunt-bot-service';
import { createUpgradeService } from '@/lib/economy/services/upgrade-service';
import { createEconomyService } from '@/lib/economy/services/economy-service';
import { createLeaderboardService } from '@/lib/economy/services/leaderboard-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user economy state
    const economyService = createEconomyService(supabase);
    const userState = await economyService.getUserEconomyState(user.id);
    
    const metrics = await economyService.getEconomyMetrics();

    // Get hunt bot status
    const huntService = createHuntBotService(supabase, user.id);
    const botStatus = await huntService.getBotStatus();
    
    // DEBUG: Log bot status details
    console.log('DEBUG - Bot Status:', {
      isRunning: botStatus.isRunning,
      progressPercent: botStatus.progressPercent,
      remainingMinutes: botStatus.remainingMinutes,
      effectiveRate: botStatus.effectiveRate,
      accumulatedProgress: botStatus.accumulatedProgress,
      freeRunAvailable: botStatus.freeRunAvailable,
      cooldownRemaining: botStatus.cooldownRemaining,
    });

    // Get upgrade status
    const upgradeService = createUpgradeService(supabase, user.id);
    const upgradeStatus = await upgradeService.getUpgradeStatus();

    // Get leaderboard data (both global and monthly)
    const leaderboardService = createLeaderboardService(supabase);
    const [monthlyRank, monthlyTop, globalRank, globalTop] = await Promise.all([
      leaderboardService.getMonthlyRank(user.id),
      leaderboardService.getMonthlyLeaderboard(10),
      leaderboardService.getGlobalRank(user.id),
      leaderboardService.getGlobalLeaderboard(10),
    ]);

    // Calculate free run cooldown
    const now = Date.now();
    const cooldownExpired = !userState?.last_free_run_at || 
      (now - userState.last_free_run_at) > (5 * 60 * 60 * 1000);
    
    let cooldownRemaining = 0;
    if (!cooldownExpired && userState?.last_free_run_at) {
      const remaining = (5 * 60 * 60 * 1000) - (now - userState.last_free_run_at);
      cooldownRemaining = Math.max(0, Math.ceil(remaining / 1000));
    }

    // Check subscription
    const isSubscribed = userState?.subscription_expiry 
      ? now < userState.subscription_expiry 
      : false;
    
    const daysRemaining = userState?.subscription_expiry 
      ? Math.max(0, Math.floor((userState.subscription_expiry - now) / (1000 * 60 * 60 * 24)))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        // User state
        user_state: userState,
        
        // Metrics
        metrics,
        
        // Bot status
        bot: {
          effective_rate: botStatus.effectiveRate,
          accumulated_progress: botStatus.accumulatedProgress,
          is_running: botStatus.isRunning,
          progress_percent: botStatus.progressPercent,
          remaining_minutes: botStatus.remainingMinutes,
          free_run_available: botStatus.freeRunAvailable,
          cooldown_remaining: botStatus.cooldownRemaining,
        },
        
        // Upgrade status
        upgrades: {
          bot_level: upgradeStatus.bot_level,
          bot_max_level: upgradeStatus.bot_max_level,
          bot_upgrade_cost: upgradeStatus.bot_upgrade_cost,
          bot_items_per_hour: upgradeStatus.bot_items_per_hour,
          bot_cost_per_hour: upgradeStatus.bot_cost_per_hour,
          bot_progress_percent: upgradeStatus.bot_progress_percent,
          
          runtime_level: upgradeStatus.runtime_level,
          runtime_max_level: upgradeStatus.runtime_max_level,
          runtime_upgrade_cost: upgradeStatus.runtime_upgrade_cost,
          max_runtime_minutes: upgradeStatus.max_runtime_minutes,
          runtime_progress_percent: upgradeStatus.runtime_progress_percent,
          
          satellite_level: upgradeStatus.satellite_level,
          satellite_max_level: upgradeStatus.satellite_max_level,
          satellite_upgrade_cost: upgradeStatus.satellite_upgrade_cost,
          satellite_bonus_bp: upgradeStatus.satellite_bonus_bp,
          satellite_progress_percent: upgradeStatus.satellite_progress_percent,
          
          cost_per_hour_level: upgradeStatus.cost_per_hour_level,
          cost_per_hour_max_level: upgradeStatus.cost_per_hour_max_level,
          cost_per_hour_upgrade_cost: upgradeStatus.cost_per_hour_upgrade_cost,
          cost_per_hour_current: upgradeStatus.cost_per_hour_current,
          cost_per_hour_progress_percent: upgradeStatus.cost_per_hour_progress_percent,
          
          token_balance: upgradeStatus.token_balance,
        },
        
        // Subscription
        subscription: {
          is_active: isSubscribed,
          days_remaining: daysRemaining,
          expires_at: userState?.subscription_expiry,
        },
        
        // Leaderboard - both global and monthly
        monthly_rank: monthlyRank,
        monthly_top_players: monthlyTop,
        global_rank: globalRank,
        global_top_players: globalTop,
      },
    });
  } catch (error) {
    console.error('ERROR in /api/economy/status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
