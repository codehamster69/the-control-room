/**
 * ITEM SELL API
 * POST /api/economy/items/sell
 * 
 * Supports:
 * - Single item sell (by quantity)
 * - Category sell (all items of a rarity)
 * - Sell all items
 */

import { createClient } from '@/lib/supabase/server';
import { createEconomyService } from '@/lib/economy/services/economy-service';
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
    const { sell_mode, category, quantity, item_id } = body;

    const economyService = createEconomyService(supabase);

    // Sell by quantity (single items) - with specific item_id
    if (sell_mode === 'quantity' && quantity && item_id) {
      const result = await economyService.sellItemById(user.id, item_id, quantity);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        sell_mode: 'quantity',
        items_sold: quantity,
        tokens_earned: result.tokens_earned,
        message: `Sold ${quantity} items for ${result.tokens_earned} berries!`,
      });
    }

    // Sell by category (all items of a rarity)
    if (sell_mode === 'category' && category) {
      const result = await economyService.sellItemsByCategory(user.id, category);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        sell_mode: 'category',
        category,
        items_sold: result.items_sold,
        tokens_earned: result.tokens_earned,
        breakdown: result.breakdown,
        message: `Sold ${result.items_sold} ${category} items for ${result.tokens_earned} berries!`,
      });
    }

    // Sell all items
    if (sell_mode === 'all') {
      const result = await economyService.sellAllItems(user.id);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        sell_mode: 'all',
        items_sold: result.items_sold,
        tokens_earned: result.tokens_earned,
        breakdown: result.breakdown,
        message: `Sold all ${result.items_sold} items for ${result.tokens_earned} berries!`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid sell mode. Use: quantity, category, or all' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/economy/items/sell
 * Get inventory breakdown for sell UI
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

    const economyService = createEconomyService(supabase);
    const breakdown = await economyService.getInventoryBreakdown(user.id);

    return NextResponse.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
