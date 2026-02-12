/**
 * HUNT COLLECT API
 * POST /api/economy/hunt/collect
 */

import { createClient } from '@/lib/supabase/server';
import { createHuntBotService } from '@/lib/economy/services/hunt-bot-service';
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

    const huntService = createHuntBotService(supabase, user.id);
    const result = await huntService.collectItems();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session_ended: true,
      items_granted: result.items_granted || 0,
      total_power_gained: result.total_power_gained || 0,
      items_received: result.items_received || [],
      message: result.items_granted 
        ? `You collected ${result.items_granted} items!`
        : 'Session completed. No items this time.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
