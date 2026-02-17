import crypto from 'crypto';
import {
  NormalizedPaymentWebhookEvent,
  RawPaymentWebhookEvent,
  SupportedCurrency,
  TicketPurchaseSession,
} from '../types';
import { CreateCheckoutSessionInput, PaymentProviderAdapter } from './payment-provider-adapter';

interface StripeLikeEvent {
  id: string;
  type: string;
  data?: {
    object?: {
      id?: string;
      payment_status?: string;
      amount_total?: number;
      currency?: string;
      metadata?: {
        userId?: string;
        paymentRef?: string;
        quantity?: string;
      };
    };
  };
}

export class StripePaymentProviderAdapter implements PaymentProviderAdapter {
  getProviderName(): string {
    return 'stripe';
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<TicketPurchaseSession> {
    const paymentRef = `stripe_${crypto.randomUUID()}`;
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!stripeSecret) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }

    if (!appUrl) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL');
    }

    const body = new URLSearchParams({
      mode: 'payment',
      success_url: `${appUrl}/marketplace?payment=success`,
      cancel_url: `${appUrl}/marketplace?payment=cancelled`,
      'line_items[0][price_data][currency]': input.currency,
      'line_items[0][price_data][product_data][name]': 'Premium Subscription Ticket (1 Month)',
      'line_items[0][price_data][unit_amount]': String(input.amount),
      'line_items[0][quantity]': String(input.quantity),
      'metadata[userId]': input.userId,
      'metadata[paymentRef]': paymentRef,
      'metadata[quantity]': String(input.quantity),
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const stripeError = await response.text();
      throw new Error(`Stripe checkout creation failed: ${stripeError}`);
    }

    const session = await response.json() as { id: string; url: string };

    if (!session.id || !session.url) {
      throw new Error('Invalid Stripe checkout session response');
    }

    return {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      paymentRef,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) {
      return false;
    }

    const timestampPart = signature
      .split(',')
      .find((part) => part.startsWith('t='))
      ?.replace('t=', '');
    const v1Part = signature
      .split(',')
      .find((part) => part.startsWith('v1='))
      ?.replace('v1=', '');

    if (!timestampPart || !v1Part) {
      return false;
    }

    const signedPayload = `${timestampPart}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    if (expectedSignature.length !== v1Part.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(v1Part, 'utf8'));
  }

  parseWebhookEvent(event: RawPaymentWebhookEvent): NormalizedPaymentWebhookEvent {
    const payload = (event.parsedEvent ?? JSON.parse(event.rawBody)) as StripeLikeEvent;
    const object = payload.data?.object;

    const metadata = object?.metadata ?? {};
    const paymentRef = metadata.paymentRef;
    const userId = metadata.userId;
    const quantityRaw = metadata.quantity;

    if (!payload.id || !payload.type || !object?.id || !paymentRef || !userId || !quantityRaw) {
      throw new Error('Invalid Stripe event payload');
    }

    const quantity = Number.parseInt(quantityRaw, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid purchased quantity in payment metadata');
    }

    const paymentStatus = object.payment_status === 'paid'
      ? 'succeeded'
      : object.payment_status === 'unpaid'
        ? 'failed'
        : 'pending';

    const currency = ((object.currency ?? 'usd') as SupportedCurrency).toLowerCase() as SupportedCurrency;
    const amount = typeof object.amount_total === 'number' ? object.amount_total : 0;

    return {
      providerEventId: payload.id,
      eventType: payload.type,
      paymentRef,
      checkoutSessionId: object.id,
      paymentStatus,
      userId,
      quantity,
      currency,
      amount,
      rawPayload: payload,
    };
  }
}
