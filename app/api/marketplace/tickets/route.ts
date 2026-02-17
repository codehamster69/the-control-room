import { createClient } from '@/lib/supabase/server';
import { createMarketplaceTicketService } from '@/lib/economy/services/marketplace-ticket-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('marketplace_tickets')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch tickets' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tickets: data ?? [] });
  } catch (error) {
    console.error('marketplace tickets GET error', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = String(body.action ?? '');
    const service = createMarketplaceTicketService(supabase);

    if (action === 'redeem') {
      const ticketId = String(body.ticketId ?? '');
      if (!ticketId) {
        return NextResponse.json({ success: false, error: 'ticketId is required' }, { status: 400 });
      }

      const result = await service.redeemTicket(ticketId, user.id);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, subscriptionExpiry: result.subscription_expiry });
    }

    if (action === 'transfer') {
      const ticketId = String(body.ticketId ?? '');
      const buyerId = String(body.buyerId ?? '');
      const priceTokens = Number.parseInt(String(body.priceTokens ?? '0'), 10);

      if (!ticketId || !buyerId || !Number.isInteger(priceTokens) || priceTokens < 0) {
        return NextResponse.json({ success: false, error: 'ticketId, buyerId and valid priceTokens are required' }, { status: 400 });
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('marketplace_tickets')
        .select('ticket_id, owner_user_id, status')
        .eq('ticket_id', ticketId)
        .eq('owner_user_id', user.id)
        .single();

      if (ticketError || !ticket) {
        return NextResponse.json({ success: false, error: 'Ticket not found or not owned by seller' }, { status: 404 });
      }

      const { data: buyer, error: buyerError } = await supabase
        .from('profiles')
        .select('id, token_balance')
        .eq('id', buyerId)
        .single();

      if (buyerError || !buyer) {
        return NextResponse.json({ success: false, error: 'Buyer not found' }, { status: 404 });
      }

      if (priceTokens > 0 && (buyer.token_balance ?? 0) < priceTokens) {
        return NextResponse.json({ success: false, error: 'Buyer has insufficient token balance' }, { status: 400 });
      }

      const { data: seller, error: sellerError } = await supabase
        .from('profiles')
        .select('id, token_balance')
        .eq('id', user.id)
        .single();

      if (sellerError || !seller) {
        return NextResponse.json({ success: false, error: 'Seller profile missing' }, { status: 404 });
      }

      if (priceTokens > 0) {
        const { error: debitError } = await supabase
          .from('profiles')
          .update({ token_balance: (buyer.token_balance ?? 0) - priceTokens })
          .eq('id', buyer.id)
          .eq('token_balance', buyer.token_balance ?? 0);

        if (debitError) {
          return NextResponse.json({ success: false, error: 'Could not debit buyer tokens' }, { status: 409 });
        }

        const { error: creditError } = await supabase
          .from('profiles')
          .update({ token_balance: (seller.token_balance ?? 0) + priceTokens })
          .eq('id', seller.id)
          .eq('token_balance', seller.token_balance ?? 0);

        if (creditError) {
          await supabase
            .from('profiles')
            .update({ token_balance: buyer.token_balance ?? 0 })
            .eq('id', buyer.id);

          return NextResponse.json({ success: false, error: 'Could not credit seller tokens' }, { status: 409 });
        }
      }

      const transfer = await service.transferTicket(ticketId, user.id, buyerId, crypto.randomUUID());
      if (!transfer.success) {
        if (priceTokens > 0) {
          await supabase.from('profiles').update({ token_balance: buyer.token_balance ?? 0 }).eq('id', buyer.id);
          await supabase.from('profiles').update({ token_balance: seller.token_balance ?? 0 }).eq('id', seller.id);
        }

        return NextResponse.json({ success: false, error: transfer.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, ticket: transfer.ticket });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('marketplace tickets POST error', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
