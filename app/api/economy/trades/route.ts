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

    const body = await request.json();
    const tradeService = createTradeService(supabase);

    switch (body.action) {
      case 'create': {
        const result = await tradeService.createTrade({
          sellerId: user.id,
          buyerId: body.buyerId,
          ticketIds: body.ticketIds,
          priceTokens: body.priceTokens,
          expiresAt: body.expiresAt,
        });

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      case 'confirm_seller': {
        const result = await tradeService.confirmSeller({
          tradeId: body.tradeId,
          sellerId: user.id,
        });

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      case 'confirm_buyer': {
        const result = await tradeService.confirmBuyer({
          tradeId: body.tradeId,
          buyerId: user.id,
        });

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Trade POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
