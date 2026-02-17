import { createClient } from '@/lib/supabase/server';
import { createTradeService } from '@/lib/economy/services/trade-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: 'Idempotency-Key header is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (!body.tradeId) {
      return NextResponse.json({ success: false, error: 'tradeId is required' }, { status: 400 });
    }

    const tradeService = createTradeService(supabase);
    const result = await tradeService.settleTrade({
      tradeId: body.tradeId,
      idempotencyKey,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Trade settle error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
