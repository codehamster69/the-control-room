export type SupportedCurrency = 'usd' | 'eur' | 'gbp' | 'inr';

export interface TicketPurchaseSession {
  checkoutSessionId: string;
  checkoutUrl: string;
  paymentRef: string;
}

export interface CreateTicketPurchaseSessionResult {
  success: boolean;
  session?: TicketPurchaseSession;
  error?: string;
}

export interface RawPaymentWebhookEvent {
  rawBody: string;
  signature: string;
  parsedEvent?: unknown;
}

export interface NormalizedPaymentWebhookEvent {
  providerEventId: string;
  eventType: string;
  paymentRef: string;
  checkoutSessionId: string;
  paymentStatus: 'succeeded' | 'failed' | 'pending';
  userId: string;
  quantity: number;
  currency: string;
  amount: number;
  rawPayload: unknown;
}

export interface PaymentWebhookResult {
  success: boolean;
  idempotent?: boolean;
  mintedQuantity?: number;
  error?: string;
}
