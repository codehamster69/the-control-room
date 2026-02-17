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
    const sessionId = `cs_test_${crypto.randomUUID().replace(/-/g, '')}`;
    const checkoutBaseUrl = process.env.STRIPE_CHECKOUT_BASE_URL ?? 'https://checkout.stripe.com/pay';

    return {
      checkoutSessionId: sessionId,
      checkoutUrl: `${checkoutBaseUrl}/${sessionId}`,
      paymentRef,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return false;
    }

    const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const received = signature.replace(/^sha256=/, '');

    if (expected.length !== received.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
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

    const currency = ((object.currency ?? 'usd') as SupportedCurrency).toLowerCase();
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
