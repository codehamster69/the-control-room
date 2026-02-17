import { handlePaymentFailureWebhook, handlePaymentSuccessWebhook } from '@/lib/billing';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature') ?? '';
    const rawBody = await request.text();

    const parsed = JSON.parse(rawBody);
    const eventType = String(parsed?.type ?? '');

    const isSuccessEvent = eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded';
    const isFailureEvent = eventType === 'checkout.session.async_payment_failed' || eventType === 'checkout.session.expired';

    if (!isSuccessEvent && !isFailureEvent) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const payload = { rawBody, signature, parsedEvent: parsed };
    const result = isSuccessEvent
      ? await handlePaymentSuccessWebhook(payload)
      : await handlePaymentFailureWebhook(payload);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error ?? 'Webhook processing failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, idempotent: result.idempotent ?? false });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ success: false, error: 'Invalid webhook payload' }, { status: 400 });
  }
}
