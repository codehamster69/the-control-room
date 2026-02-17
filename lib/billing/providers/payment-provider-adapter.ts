import {
  NormalizedPaymentWebhookEvent,
  RawPaymentWebhookEvent,
  SupportedCurrency,
  TicketPurchaseSession,
} from '../types';

export interface CreateCheckoutSessionInput {
  userId: string;
  quantity: number;
  currency: SupportedCurrency;
  amount: number;
}

export interface PaymentProviderAdapter {
  getProviderName(): string;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<TicketPurchaseSession>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(event: RawPaymentWebhookEvent): NormalizedPaymentWebhookEvent;
}
