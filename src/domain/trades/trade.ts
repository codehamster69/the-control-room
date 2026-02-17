export const TRADE_STATES = [
  'draft',
  'seller_confirmed',
  'buyer_confirmed',
  'ready_to_settle',
  'settled',
  'cancelled',
  'expired',
] as const;

export type TradeState = (typeof TRADE_STATES)[number];

export type TradeProps = {
  id: string;
  sellerId: string;
  buyerId: string;
  ticketIds: string[];
  priceTokens: number;
  state: TradeState;
  sellerConfirmedAt?: string | null;
  buyerConfirmedAt?: string | null;
  settledAt?: string | null;
  cancelledAt?: string | null;
  expiresAt?: string | null;
};

export class Trade {
  private constructor(private readonly props: TradeProps) {}

  static createDraft(input: {
    id: string;
    sellerId: string;
    buyerId: string;
    ticketIds: string[];
    priceTokens: number;
    expiresAt?: string | null;
  }): Trade {
    if (input.ticketIds.length === 0) {
      throw new Error('At least one ticket is required');
    }

    if (input.priceTokens < 0) {
      throw new Error('priceTokens must be >= 0');
    }

    return new Trade({
      ...input,
      state: 'draft',
      sellerConfirmedAt: null,
      buyerConfirmedAt: null,
      settledAt: null,
      cancelledAt: null,
    });
  }

  static hydrate(props: TradeProps): Trade {
    return new Trade(props);
  }

  get value(): TradeProps {
    return this.props;
  }

  confirmSeller(atIso: string): Trade {
    if (!['draft', 'buyer_confirmed'].includes(this.props.state)) {
      throw new Error(`Seller confirmation not allowed from ${this.props.state}`);
    }

    const nextState: TradeState = this.props.buyerConfirmedAt
      ? 'ready_to_settle'
      : 'seller_confirmed';

    return Trade.hydrate({
      ...this.props,
      state: nextState,
      sellerConfirmedAt: atIso,
    });
  }

  confirmBuyer(atIso: string): Trade {
    if (!['draft', 'seller_confirmed'].includes(this.props.state)) {
      throw new Error(`Buyer confirmation not allowed from ${this.props.state}`);
    }

    const nextState: TradeState = this.props.sellerConfirmedAt
      ? 'ready_to_settle'
      : 'buyer_confirmed';

    return Trade.hydrate({
      ...this.props,
      state: nextState,
      buyerConfirmedAt: atIso,
    });
  }

  cancel(atIso: string): Trade {
    if (['settled', 'cancelled', 'expired'].includes(this.props.state)) {
      throw new Error(`Cannot cancel a trade in ${this.props.state}`);
    }

    return Trade.hydrate({
      ...this.props,
      state: 'cancelled',
      cancelledAt: atIso,
    });
  }

  expire(atIso: string): Trade {
    if (['settled', 'cancelled', 'expired'].includes(this.props.state)) {
      throw new Error(`Cannot expire a trade in ${this.props.state}`);
    }

    return Trade.hydrate({
      ...this.props,
      state: 'expired',
      cancelledAt: atIso,
    });
  }

  settle(atIso: string): Trade {
    if (this.props.state !== 'ready_to_settle') {
      throw new Error('Trade is not ready to settle');
    }

    if (!this.props.sellerConfirmedAt || !this.props.buyerConfirmedAt) {
      throw new Error('Both buyer and seller must confirm before settlement');
    }

    return Trade.hydrate({
      ...this.props,
      state: 'settled',
      settledAt: atIso,
    });
  }
}
