import { Trade, TradeProps, TradeState } from '@/src/domain/trades';

const OPEN_TRADE_STATES: TradeState[] = [
  'draft',
  'seller_confirmed',
  'buyer_confirmed',
  'ready_to_settle',
];

export class TradeService {
  constructor(private readonly supabase: any) {}

  async createTrade(input: {
    sellerId: string;
    buyerId: string;
    ticketIds: string[];
    priceTokens: number;
    expiresAt?: string;
  }): Promise<{ success: boolean; trade?: TradeProps; error?: string }> {
    try {
      const trade = Trade.createDraft({
        id: crypto.randomUUID(),
        sellerId: input.sellerId,
        buyerId: input.buyerId,
        ticketIds: input.ticketIds,
        priceTokens: input.priceTokens,
        expiresAt: input.expiresAt ?? null,
      });

      const { data: ownedTickets, error: ownedError } = await this.supabase
        .from('tickets')
        .select('id, owner_id, locked_in_trade_id')
        .in('id', input.ticketIds)
        .eq('owner_id', input.sellerId);

      if (ownedError) {
        return { success: false, error: 'Failed to validate ownership' };
      }

      if (!ownedTickets || ownedTickets.length !== input.ticketIds.length) {
        return { success: false, error: 'Seller must own all selected tickets' };
      }

      if (ownedTickets.some((ticket: any) => ticket.locked_in_trade_id)) {
        return { success: false, error: 'One or more tickets are already locked in trade' };
      }

      const now = new Date().toISOString();
      const { data: createdTrade, error: createError } = await this.supabase
        .from('trades')
        .insert({
          id: trade.value.id,
          seller_id: input.sellerId,
          buyer_id: input.buyerId,
          ticket_ids: input.ticketIds,
          price_tokens: input.priceTokens,
          state: 'draft',
          expires_at: input.expiresAt,
          created_at: now,
        })
        .select('*')
        .single();

      if (createError || !createdTrade) {
        return { success: false, error: 'Failed to create trade' };
      }

      const { error: lockError } = await this.supabase
        .from('tickets')
        .update({ locked_in_trade_id: createdTrade.id })
        .in('id', input.ticketIds)
        .eq('owner_id', input.sellerId)
        .is('locked_in_trade_id', null);

      if (lockError) {
        await this.supabase.from('trades').delete().eq('id', createdTrade.id);
        return { success: false, error: 'Failed to lock selected tickets' };
      }

      return { success: true, trade: this.mapTrade(createdTrade) };
    } catch (error) {
      console.error('createTrade error:', error);
      return { success: false, error: 'Trade creation failed' };
    }
  }

  async confirmBuyer(input: {
    tradeId: string;
    buyerId: string;
  }): Promise<{ success: boolean; trade?: TradeProps; error?: string }> {
    const { data: tradeRow, error: tradeError } = await this.supabase
      .from('trades')
      .select('*')
      .eq('id', input.tradeId)
      .single();

    if (tradeError || !tradeRow) {
      return { success: false, error: 'Trade not found' };
    }

    if (tradeRow.buyer_id !== input.buyerId) {
      return { success: false, error: 'Not trade buyer' };
    }

    const { data: buyer, error: buyerError } = await this.supabase
      .from('profiles')
      .select('id, token_balance, reserved_token_balance')
      .eq('id', input.buyerId)
      .single();

    if (buyerError || !buyer) {
      return { success: false, error: 'Buyer profile missing' };
    }

    const reservedBalance = buyer.reserved_token_balance ?? 0;
    const availableTokens = buyer.token_balance - reservedBalance;
    if (availableTokens < tradeRow.price_tokens) {
      return { success: false, error: 'Insufficient available tokens for reservation' };
    }

    const now = new Date().toISOString();
    const aggregate = Trade.hydrate(this.mapTrade(tradeRow));
    const next = aggregate.confirmBuyer(now);

    const { data: updatedTrade, error: updateTradeError } = await this.supabase
      .from('trades')
      .update({
        state: next.value.state,
        buyer_confirmed_at: now,
      })
      .eq('id', input.tradeId)
      .in('state', ['draft', 'seller_confirmed'])
      .select('*')
      .single();

    if (updateTradeError || !updatedTrade) {
      return { success: false, error: 'Could not confirm buyer' };
    }

    const { error: reserveError } = await this.supabase
      .from('profiles')
      .update({
        reserved_token_balance: reservedBalance + tradeRow.price_tokens,
      })
      .eq('id', input.buyerId)
      .eq('token_balance', buyer.token_balance)
      .eq('reserved_token_balance', reservedBalance);

    if (reserveError) {
      return { success: false, error: 'Failed to reserve buyer tokens' };
    }

    return { success: true, trade: this.mapTrade(updatedTrade) };
  }

  async confirmSeller(input: { tradeId: string; sellerId: string }): Promise<{ success: boolean; trade?: TradeProps; error?: string }> {
    const { data: tradeRow, error: tradeError } = await this.supabase
      .from('trades')
      .select('*')
      .eq('id', input.tradeId)
      .single();

    if (tradeError || !tradeRow) {
      return { success: false, error: 'Trade not found' };
    }

    if (tradeRow.seller_id !== input.sellerId) {
      return { success: false, error: 'Not trade seller' };
    }

    const now = new Date().toISOString();
    const aggregate = Trade.hydrate(this.mapTrade(tradeRow));
    const next = aggregate.confirmSeller(now);

    const { data: updatedTrade, error: updateTradeError } = await this.supabase
      .from('trades')
      .update({
        state: next.value.state,
        seller_confirmed_at: now,
      })
      .eq('id', input.tradeId)
      .in('state', ['draft', 'buyer_confirmed'])
      .select('*')
      .single();

    if (updateTradeError || !updatedTrade) {
      return { success: false, error: 'Could not confirm seller' };
    }

    return { success: true, trade: this.mapTrade(updatedTrade) };
  }

  async settleTrade(input: {
    tradeId: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; trade?: TradeProps; error?: string }> {

    const { data: atomicSettlement, error: atomicError } = await this.supabase.rpc('settle_trade_atomic', {
      p_trade_id: input.tradeId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (!atomicError && atomicSettlement) {
      return { success: true, trade: this.mapTrade(atomicSettlement) };
    }

    const { data: idemExisting } = await this.supabase
      .from('trade_settlement_idempotency')
      .select('trade_id, settlement_response, status')
      .eq('idempotency_key', input.idempotencyKey)
      .single();

    if (idemExisting?.status === 'completed') {
      return { success: true, trade: idemExisting.settlement_response };
    }

    const { data: tradeRow, error: tradeError } = await this.supabase
      .from('trades')
      .select('*')
      .eq('id', input.tradeId)
      .single();

    if (tradeError || !tradeRow) {
      return { success: false, error: 'Trade not found' };
    }

    if (tradeRow.state === 'settled') {
      return { success: true, trade: this.mapTrade(tradeRow) };
    }

    if (tradeRow.state !== 'ready_to_settle') {
      return { success: false, error: 'Trade is not ready to settle' };
    }

    if (!tradeRow.seller_confirmed_at || !tradeRow.buyer_confirmed_at) {
      return { success: false, error: 'Trade confirmations are incomplete' };
    }

    const { data: sellerLocks } = await this.supabase
      .from('tickets')
      .select('id')
      .in('id', tradeRow.ticket_ids)
      .eq('locked_in_trade_id', tradeRow.id)
      .eq('owner_id', tradeRow.seller_id);

    if (!sellerLocks || sellerLocks.length !== tradeRow.ticket_ids.length) {
      return { success: false, error: 'Ticket locks are invalid' };
    }

    const { data: buyerProfile, error: buyerErr } = await this.supabase
      .from('profiles')
      .select('id, token_balance, reserved_token_balance')
      .eq('id', tradeRow.buyer_id)
      .single();

    const { data: sellerProfile, error: sellerErr } = await this.supabase
      .from('profiles')
      .select('id, token_balance')
      .eq('id', tradeRow.seller_id)
      .single();

    if (buyerErr || sellerErr || !buyerProfile || !sellerProfile) {
      return { success: false, error: 'Participant profiles are missing' };
    }

    if ((buyerProfile.reserved_token_balance ?? 0) < tradeRow.price_tokens) {
      return { success: false, error: 'Buyer token lock is invalid' };
    }

    const now = new Date().toISOString();

    // Settlement is guarded by compare-and-swap style state transition.
    const { data: settledTrade, error: settleError } = await this.supabase
      .from('trades')
      .update({
        state: 'settled',
        settled_at: now,
      })
      .eq('id', tradeRow.id)
      .eq('state', 'ready_to_settle')
      .not('seller_confirmed_at', 'is', null)
      .not('buyer_confirmed_at', 'is', null)
      .select('*')
      .single();

    if (settleError || !settledTrade) {
      return { success: false, error: 'Trade already settled or updated by another process' };
    }

    const tokenTransfer = tradeRow.price_tokens;

    const { error: debitBuyerError } = await this.supabase
      .from('profiles')
      .update({
        token_balance: buyerProfile.token_balance - tokenTransfer,
        reserved_token_balance: (buyerProfile.reserved_token_balance ?? 0) - tokenTransfer,
      })
      .eq('id', buyerProfile.id)
      .eq('token_balance', buyerProfile.token_balance)
      .eq('reserved_token_balance', buyerProfile.reserved_token_balance ?? 0);

    if (debitBuyerError) {
      return { success: false, error: 'Failed to debit buyer reserved tokens' };
    }

    if (tokenTransfer > 0) {
      await this.supabase
        .from('profiles')
        .update({ token_balance: sellerProfile.token_balance + tokenTransfer })
        .eq('id', sellerProfile.id)
        .eq('token_balance', sellerProfile.token_balance);
    }

    await this.supabase
      .from('tickets')
      .update({
        owner_id: tradeRow.buyer_id,
        locked_in_trade_id: null,
      })
      .in('id', tradeRow.ticket_ids)
      .eq('locked_in_trade_id', tradeRow.id)
      .eq('owner_id', tradeRow.seller_id);

    await this.supabase
      .from('trade_settlement_idempotency')
      .upsert({
        idempotency_key: input.idempotencyKey,
        trade_id: tradeRow.id,
        status: 'completed',
        settlement_response: this.mapTrade(settledTrade),
        completed_at: now,
      }, { onConflict: 'idempotency_key' });

    return { success: true, trade: this.mapTrade(settledTrade) };
  }

  private mapTrade(row: any): TradeProps {
    return {
      id: row.id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id,
      ticketIds: row.ticket_ids,
      priceTokens: row.price_tokens,
      state: row.state,
      sellerConfirmedAt: row.seller_confirmed_at,
      buyerConfirmedAt: row.buyer_confirmed_at,
      settledAt: row.settled_at,
      cancelledAt: row.cancelled_at,
      expiresAt: row.expires_at,
    };
  }

  async expireStaleTrades(): Promise<number> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('trades')
      .update({
        state: 'expired',
        cancelled_at: nowIso,
      })
      .in('state', OPEN_TRADE_STATES)
      .lt('expires_at', nowIso)
      .select('id, ticket_ids, buyer_id, price_tokens');

    if (error || !data) {
      return 0;
    }

    for (const trade of data) {
      await this.supabase
        .from('tickets')
        .update({ locked_in_trade_id: null })
        .eq('locked_in_trade_id', trade.id);

      const { data: buyer } = await this.supabase
        .from('profiles')
        .select('reserved_token_balance')
        .eq('id', trade.buyer_id)
        .single();

      if (buyer) {
        await this.supabase
          .from('profiles')
          .update({
            reserved_token_balance: Math.max(0, (buyer.reserved_token_balance ?? 0) - trade.price_tokens),
          })
          .eq('id', trade.buyer_id);
      }
    }

    return data.length;
  }
}

export function createTradeService(supabaseClient: any): TradeService {
  return new TradeService(supabaseClient);
}
