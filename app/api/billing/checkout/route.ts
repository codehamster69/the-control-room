import { createClient } from '@/lib/supabase/server';
import { createTicketPurchaseSession, SupportedCurrency } from '@/lib/billing';
import { NextRequest, NextResponse } from 'next/server';

const UNIT_AMOUNTS: Record<SupportedCurrency, number> = {
  usd: Number.parseInt(process.env.MARKETPLACE_TICKET_PRICE_USD ?? '499', 10),
  eur: Number.parseInt(process.env.MARKETPLACE_TICKET_PRICE_EUR ?? '499', 10),
  gbp: Number.parseInt(process.env.MARKETPLACE_TICKET_PRICE_GBP ?? '499', 10),
  inr: Number.parseInt(process.env.MARKETPLACE_TICKET_PRICE_INR ?? '39900', 10),
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const quantity = Number.parseInt(String(body.quantity ?? ''), 10);
    const currency = (String(body.currency ?? 'usd').toLowerCase()) as SupportedCurrency;

    if (!Object.prototype.hasOwnProperty.call(UNIT_AMOUNTS, currency)) {
      return NextResponse.json({ success: false, error: 'Unsupported currency' }, { status: 400 });
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 25) {
      return NextResponse.json({ success: false, error: 'quantity must be between 1 and 25' }, { status: 400 });
    }

    const amount = UNIT_AMOUNTS[currency];
    const result = await createTicketPurchaseSession(user.id, quantity, currency, amount);

    if (!result.success || !result.session) {
      return NextResponse.json({ success: false, error: result.error ?? 'Unable to create checkout session' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: result.session.checkoutUrl,
      checkoutSessionId: result.session.checkoutSessionId,
      paymentRef: result.session.paymentRef,
    });
  } catch (error) {
    console.error('Billing checkout error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
