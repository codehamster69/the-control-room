import { createAdminClient } from '@/lib/supabase/server';
import { createMarketplaceTicketService } from '@/lib/economy/services/marketplace-ticket-service';
import {
  CreateTicketPurchaseSessionResult,
  PaymentWebhookResult,
  RawPaymentWebhookEvent,
  SupportedCurrency,
} from './types';
import { PaymentProviderAdapter } from './providers/payment-provider-adapter';

export class BillingService {
  private paymentProvider: PaymentProviderAdapter;

  constructor(paymentProvider: PaymentProviderAdapter) {
    this.paymentProvider = paymentProvider;
  }

  async createTicketPurchaseSession(
    userId: string,
    quantity: number,
    currency: SupportedCurrency,
    amount: number,
  ): Promise<CreateTicketPurchaseSessionResult> {
    if (!userId?.trim()) {
      return { success: false, error: 'userId is required' };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, error: 'quantity must be a positive integer' };
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return { success: false, error: 'amount must be a positive integer in minor currency units' };
    }

    const session = await this.paymentProvider.createCheckoutSession({
      userId,
      quantity,
      currency,
      amount,
    });

    const supabase = await createAdminClient();
    await supabase.from('billing_payments').insert({
      provider_name: this.paymentProvider.getProviderName(),
      payment_ref: session.paymentRef,
      checkout_session_id: session.checkoutSessionId,
      user_id: userId,
      quantity,
      currency,
      amount,
      status: 'checkout_created',
    });

    return {
      success: true,
      session,
    };
  }

  async handlePaymentSuccessWebhook(paymentEvent: RawPaymentWebhookEvent): Promise<PaymentWebhookResult> {
    const isValid = this.paymentProvider.verifyWebhookSignature(paymentEvent.rawBody, paymentEvent.signature);
    if (!isValid) {
      return { success: false, error: 'Invalid webhook signature' };
    }

    const event = this.paymentProvider.parseWebhookEvent(paymentEvent);
    if (event.paymentStatus !== 'succeeded') {
      return { success: false, error: 'Payment is not confirmed as successful' };
    }

    return this.processVerifiedEvent(event, true);
  }

  async handlePaymentFailureWebhook(paymentEvent: RawPaymentWebhookEvent): Promise<PaymentWebhookResult> {
    const isValid = this.paymentProvider.verifyWebhookSignature(paymentEvent.rawBody, paymentEvent.signature);
    if (!isValid) {
      return { success: false, error: 'Invalid webhook signature' };
    }

    const event = this.paymentProvider.parseWebhookEvent(paymentEvent);
    return this.processVerifiedEvent(event, false);
  }

  private async processVerifiedEvent(event: ReturnType<PaymentProviderAdapter['parseWebhookEvent']>, isSuccess: boolean): Promise<PaymentWebhookResult> {
    const supabase = await createAdminClient();

    const { error: insertEventError } = await supabase
      .from('billing_payment_events')
      .insert({
        provider_name: this.paymentProvider.getProviderName(),
        provider_event_id: event.providerEventId,
        event_type: event.eventType,
        payment_ref: event.paymentRef,
        checkout_session_id: event.checkoutSessionId,
        event_payload: event.rawPayload,
        processing_status: 'processing',
      });

    if (insertEventError?.code === '23505') {
      return {
        success: true,
        idempotent: true,
      };
    }

    if (insertEventError) {
      return {
        success: false,
        error: 'Failed to record payment event',
      };
    }

    const paymentStatus = isSuccess ? 'succeeded' : 'failed';

    await supabase
      .from('billing_payments')
      .upsert({
        provider_name: this.paymentProvider.getProviderName(),
        payment_ref: event.paymentRef,
        checkout_session_id: event.checkoutSessionId,
        user_id: event.userId,
        quantity: event.quantity,
        currency: event.currency,
        amount: event.amount,
        status: paymentStatus,
        confirmed_provider_event_id: event.providerEventId,
      }, {
        onConflict: 'payment_ref',
      });

    if (!isSuccess || event.paymentStatus !== 'succeeded') {
      await supabase
        .from('billing_payment_events')
        .update({
          processing_status: 'processed',
          processed_at: new Date().toISOString(),
          minted_quantity: 0,
        })
        .eq('provider_name', this.paymentProvider.getProviderName())
        .eq('provider_event_id', event.providerEventId);

      return { success: true, mintedQuantity: 0 };
    }

    const marketplaceTicketService = createMarketplaceTicketService(supabase);

    for (let i = 0; i < event.quantity; i += 1) {
      const ticketPaymentRef = event.quantity === 1
        ? event.paymentRef
        : `${event.paymentRef}#${i + 1}`;

      const minted = await marketplaceTicketService.mintTicketForMoney(event.userId, ticketPaymentRef);
      if (!minted.success) {
        await supabase
          .from('billing_payment_events')
          .update({
            processing_status: 'failed',
            processed_at: new Date().toISOString(),
            failure_reason: minted.error,
          })
          .eq('provider_name', this.paymentProvider.getProviderName())
          .eq('provider_event_id', event.providerEventId);

        return {
          success: false,
          error: minted.error ?? 'Minting failed after successful payment',
        };
      }
    }

    await supabase
      .from('billing_payment_events')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        minted_quantity: event.quantity,
      })
      .eq('provider_name', this.paymentProvider.getProviderName())
      .eq('provider_event_id', event.providerEventId);

    return {
      success: true,
      mintedQuantity: event.quantity,
    };
  }
}
