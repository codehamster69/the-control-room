import { BillingService } from './billing-service';
import { StripePaymentProviderAdapter } from './providers/stripe-payment-provider';
import { RawPaymentWebhookEvent, SupportedCurrency } from './types';

function createBillingService(): BillingService {
  return new BillingService(new StripePaymentProviderAdapter());
}

export async function createTicketPurchaseSession(
  userId: string,
  quantity: number,
  currency: SupportedCurrency,
  amount: number,
) {
  return createBillingService().createTicketPurchaseSession(userId, quantity, currency, amount);
}

export async function handlePaymentSuccessWebhook(paymentEvent: RawPaymentWebhookEvent) {
  return createBillingService().handlePaymentSuccessWebhook(paymentEvent);
}

export async function handlePaymentFailureWebhook(paymentEvent: RawPaymentWebhookEvent) {
  return createBillingService().handlePaymentFailureWebhook(paymentEvent);
}

export * from './types';
export * from './billing-service';
export * from './providers/payment-provider-adapter';
export * from './providers/stripe-payment-provider';
