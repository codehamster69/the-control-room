import {
  MARKETPLACE_TICKET_SOURCE,
  MARKETPLACE_TICKET_STATUS,
  MarketplaceTicket,
} from '../domain/tickets/marketplace-ticket';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export class MarketplaceTicketService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async mintTicketForMoney(userId: string, paymentRef: string): Promise<{
    success: boolean;
    ticket?: MarketplaceTicket;
    error?: string;
  }> {
    if (!paymentRef?.trim()) {
      return { success: false, error: 'paymentRef is required' };
    }

    const { data, error } = await this.supabase
      .from('marketplace_tickets')
      .insert({
        owner_user_id: userId,
        source: MARKETPLACE_TICKET_SOURCE.FIAT_MINT,
        status: MARKETPLACE_TICKET_STATUS.OWNED,
        redeem_value_months: 1,
        payment_ref: paymentRef.trim(),
      })
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, error: 'Failed to mint ticket for payment reference' };
    }

    return { success: true, ticket: data as MarketplaceTicket };
  }

  async listTicketForTrade(ticketId: string, sellerId: string, priceTokens: number): Promise<{
    success: boolean;
    ticket?: MarketplaceTicket;
    error?: string;
  }> {
    if (!Number.isInteger(priceTokens) || priceTokens <= 0) {
      return { success: false, error: 'priceTokens must be a positive integer' };
    }

    const { data, error } = await this.supabase
      .from('marketplace_tickets')
      .update({
        status: MARKETPLACE_TICKET_STATUS.LISTED,
        listed_price_tokens: priceTokens,
      })
      .eq('ticket_id', ticketId)
      .eq('owner_user_id', sellerId)
      .eq('status', MARKETPLACE_TICKET_STATUS.OWNED)
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, error: 'Ticket is not owned by seller or not eligible for listing' };
    }

    return { success: true, ticket: data as MarketplaceTicket };
  }

  async redeemTicket(ticketId: string, ownerId: string): Promise<{
    success: boolean;
    subscription_expiry?: number;
    error?: string;
  }> {
    const now = Date.now();

    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('subscription_expiry')
      .eq('id', ownerId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Owner profile not found' };
    }

    const baseExpiry = typeof profile.subscription_expiry === 'number'
      ? Math.max(profile.subscription_expiry, now)
      : now;
    const nextExpiry = baseExpiry + ONE_MONTH_MS;

    const { data: updatedTicket, error: ticketError } = await this.supabase
      .from('marketplace_tickets')
      .update({
        status: MARKETPLACE_TICKET_STATUS.REDEEMED,
        redeemed_at: new Date(now).toISOString(),
        listed_price_tokens: null,
        active_trade_id: null,
      })
      .eq('ticket_id', ticketId)
      .eq('owner_user_id', ownerId)
      .in('status', [
        MARKETPLACE_TICKET_STATUS.OWNED,
        MARKETPLACE_TICKET_STATUS.CANCELLED,
      ])
      .eq('redeemed_at', null)
      .select('ticket_id')
      .single();

    if (ticketError || !updatedTicket) {
      return { success: false, error: 'Ticket cannot be redeemed' };
    }

    const { error: updateProfileError } = await this.supabase
      .from('profiles')
      .update({ subscription_expiry: nextExpiry })
      .eq('id', ownerId);

    if (updateProfileError) {
      return { success: false, error: 'Failed to grant premium subscription' };
    }

    return { success: true, subscription_expiry: nextExpiry };
  }

  async transferTicket(ticketId: string, fromUserId: string, toUserId: string, tradeId: string): Promise<{
    success: boolean;
    ticket?: MarketplaceTicket;
    error?: string;
  }> {
    const { data, error } = await this.supabase
      .from('marketplace_tickets')
      .update({
        owner_user_id: toUserId,
        status: MARKETPLACE_TICKET_STATUS.OWNED,
        listed_price_tokens: null,
        active_trade_id: null,
        transferred_at: new Date().toISOString(),
      })
      .eq('ticket_id', ticketId)
      .eq('owner_user_id', fromUserId)
      .in('status', [
        MARKETPLACE_TICKET_STATUS.LISTED,
        MARKETPLACE_TICKET_STATUS.LOCKED_IN_TRADE,
      ])
      .or(`active_trade_id.is.null,active_trade_id.eq.${tradeId}`)
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, error: 'Ticket transfer failed' };
    }

    await this.supabase
      .from('marketplace_ticket_transfers')
      .insert({
        ticket_id: ticketId,
        trade_id: tradeId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
      });

    return { success: true, ticket: data as MarketplaceTicket };
  }
}

export function createMarketplaceTicketService(supabaseClient: any): MarketplaceTicketService {
  return new MarketplaceTicketService(supabaseClient);
}
