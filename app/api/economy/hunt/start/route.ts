/**
 * HUNT START API
 * POST /api/economy/hunt/start
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

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    
    const { session_type, runtime_minutes } = body;

    const huntService = createHuntBotService(supabase, user.id);

    // Start hunt based on type
    if (session_type === 'free') {
      const result = await huntService.startFreeHunt();
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        session_started: true,
        session_type: 'free',
        runtime_minutes: 15,
        message: 'Free hunt started!',
      });
    } else if (session_type === 'paid') {
      const runtime = runtime_minutes || 15;
      
      const result = await huntService.startPaidHunt(runtime);
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        session_started: true,
        session_type: 'paid',
        runtime_minutes: runtime,
        tokens_spent: result.tokens_spent,
        message: `Paid hunt started for ${runtime} minutes (${result.tokens_spent} berries)`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid session type' },
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
