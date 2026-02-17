export const MARKETPLACE_TICKET_SOURCE = {
  FIAT_MINT: 'fiat_mint',
} as const;

export const MARKETPLACE_TICKET_STATUS = {
  OWNED: 'owned',
  LISTED: 'listed',
  LOCKED_IN_TRADE: 'locked_in_trade',
  REDEEMED: 'redeemed',
  CANCELLED: 'cancelled',
} as const;

export type MarketplaceTicketSource = typeof MARKETPLACE_TICKET_SOURCE[keyof typeof MARKETPLACE_TICKET_SOURCE];
export type MarketplaceTicketStatus = typeof MARKETPLACE_TICKET_STATUS[keyof typeof MARKETPLACE_TICKET_STATUS];

export interface MarketplaceTicket {
  ticket_id: string;
  owner_user_id: string;
  source: MarketplaceTicketSource;
  status: MarketplaceTicketStatus;
  redeem_value_months: 1;
  listed_price_tokens: number | null;
  active_trade_id: string | null;
  payment_ref: string | null;
  created_at: string;
  updated_at: string;
  transferred_at: string | null;
  redeemed_at: string | null;
}

export interface MarketplaceTicketTransfer {
  transfer_id: string;
  ticket_id: string;
  trade_id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
}
