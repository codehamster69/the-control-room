/**
 * UPGRADE API
 * POST /api/economy/upgrades
 */

import { createClient } from '@/lib/supabase/server';
import { createUpgradeService } from '@/lib/economy/services/upgrade-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    // Check Instagram verification
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_instagram_verified')
      .eq('id', user.id)
      .single();

    if (!profile?.is_instagram_verified) {
      return NextResponse.json(
        { success: false, error: 'Instagram verification required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { upgrade_type, levels = 1 } = body;

    const upgradeService = createUpgradeService(supabase, user.id);

    switch (upgrade_type) {
      case 'bot': {
        const result = await upgradeService.upgradeBotBulk(levels);
        
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          upgrade_type: 'bot',
          new_level: result.new_level,
          tokens_spent: result.tokens_spent,
          levels_upgraded: result.levels_upgraded,
          message: result.levels_upgraded && result.levels_upgraded > 1 
            ? `Bot upgraded ${result.levels_upgraded} levels to level ${result.new_level}!`
            : `Bot upgraded to level ${result.new_level}!`,
        });
      }

      case 'runtime': {
        const result = await upgradeService.upgradeRuntimeBulk(levels);
        
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          upgrade_type: 'runtime',
          new_level: result.new_level,
          tokens_spent: result.tokens_spent,
          levels_upgraded: result.levels_upgraded,
          message: result.levels_upgraded && result.levels_upgraded > 1 
            ? `Runtime upgraded ${result.levels_upgraded} levels to level ${result.new_level}!`
            : `Runtime upgraded to level ${result.new_level}!`,
        });
      }

      case 'satellite': {
        const result = await upgradeService.upgradeSatelliteBulk(levels);
        
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          upgrade_type: 'satellite',
          new_level: result.new_level,
          tokens_spent: result.tokens_spent,
          levels_upgraded: result.levels_upgraded,
          message: result.levels_upgraded && result.levels_upgraded > 1 
            ? `Satellite upgraded ${result.levels_upgraded} levels to level ${result.new_level}!`
            : `Satellite upgraded to level ${result.new_level}!`,
        });
      }

      case 'cost': {
        const result = await upgradeService.upgradeCostPerHourBulk(levels);
        
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          upgrade_type: 'cost',
          new_level: result.new_level,
          tokens_spent: result.tokens_spent,
          levels_upgraded: result.levels_upgraded,
          message: result.levels_upgraded && result.levels_upgraded > 1 
            ? `Cost per hour upgraded ${result.levels_upgraded} levels to level ${result.new_level}!`
            : `Cost per hour upgraded to level ${result.new_level}!`,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid upgrade type' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/economy/upgrades
 * Get current upgrade status
 */
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

    const upgradeService = createUpgradeService(supabase, user.id);
    const status = await upgradeService.getUpgradeStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
