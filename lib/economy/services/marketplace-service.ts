/**
 * MARKETPLACE SERVICE
 * 
 * Handles ticket marketplace with token burns.
 * 5% burn on every trade.
 */

import { createClient } from '@/lib/supabase/server';
import {
  MarketplaceListing,
  MarketplaceTransaction,
  UserEconomyState,
} from '../types';
import { calculateMarketplaceBurn } from '../utils';
import { MARKETPLACE_BURN_RATE_BP, MARKETPLACE_PLATFORM_FEE_BP } from '../constants';

export class MarketplaceService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * List a ticket for sale
   */
  async listTicket(
    sellerId: string,
    ticketId: string,
    price: number
  ): Promise<{
    success: boolean;
    listing?: MarketplaceListing;
    error?: string;
  }> {
    // Validate price
    if (price <= 0) {
      return { success: false, error: 'Invalid price' };
    }

    // Get ticket
    const { data: ticket, error: ticketError } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    if (ticket.owner_id !== sellerId) {
      return { success: false, error: 'You do not own this ticket' };
    }

    if (ticket.is_activated) {
      return { success: false, error: 'Cannot sell activated ticket' };
    }

    if (ticket.marketplace_listing_id) {
      return { success: false, error: 'Ticket already listed' };
    }

    // Check if seller already has another listing (optional limit)
    const { data: existingListings } = await this.supabase
      .from('ticket_marketplace')
      .select('id')
      .eq('seller_id', sellerId)
      .is('completed_at', null);

    if (existingListings && existingListings.length >= 3) {
      return { success: false, error: 'Maximum 3 listings at a time' };
    }

    // Create listing
    const now = new Date().toISOString();
    const { data: listing, error: listingError } = await this.supabase
      .from('ticket_marketplace')
      .insert({
        ticket_id: ticketId,
        seller_id: sellerId,
        price: price,
        listed_at: now,
      })
      .select()
      .single();

    if (listingError) {
      return { success: false, error: 'Failed to create listing' };
    }

    // Update ticket
    await this.supabase
      .from('tickets')
      .update({ marketplace_listing_id: listing.id })
      .eq('id', ticketId);

    // Update metrics
    await this.updateMetrics('tickets_listed', 1);

    return {
      success: true,
      listing: {
        id: listing.id,
        ticket_id: listing.ticket_id,
        seller_id: listing.seller_id,
        price: listing.price,
        listed_at: new Date(listing.listed_at).getTime(),
        ticket_activated: ticket.is_activated,
        ticket_expires_at: ticket.expires_at ? new Date(ticket.expires_at).getTime() : undefined,
      },
    };
  }

  /**
   * Cancel a listing
   */
  async cancelListing(
    sellerId: string,
    listingId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Get listing
    const { data: listing, error: listingError } = await this.supabase
      .from('ticket_marketplace')
      .select('*')
      .eq('id', listingId)
      .is('completed_at', null)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    if (listing.seller_id !== sellerId) {
      return { success: false, error: 'Not your listing' };
    }

    // Remove listing
    await this.supabase
      .from('ticket_marketplace')
      .delete()
      .eq('id', listingId);

    // Update ticket
    await this.supabase
      .from('tickets')
      .update({ marketplace_listing_id: null })
      .eq('id', listing.ticket_id);

    return { success: true };
  }

  /**
   * Buy a ticket from marketplace
   */
  async buyTicket(
    buyerId: string,
    listingId: string
  ): Promise<{
    success: boolean;
    transaction?: MarketplaceTransaction;
    error?: string;
  }> {
    const now = Date.now();

    // Get listing
    const { data: listing, error: listingError } = await this.supabase
      .from('ticket_marketplace')
      .select(`
        *,
        tickets: ticket_id (*)
      `)
      .eq('id', listingId)
      .is('completed_at', null)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    if (listing.seller_id === buyerId) {
      return { success: false, error: 'Cannot buy your own listing' };
    }

    // Check if ticket is still valid
    if (listing.tickets.is_activated && listing.tickets.expires_at) {
      const expiry = new Date(listing.tickets.expires_at).getTime();
      if (expiry < now) {
        return { success: false, error: 'Ticket has expired' };
      }
    }

    // Get buyer balance
    const { data: buyerProfile, error: buyerError } = await this.supabase
      .from('profiles')
      .select('id, token_balance, owned_ticket_ids')
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyerProfile) {
      return { success: false, error: 'Buyer not found' };
    }

    if (buyerProfile.token_balance < listing.price) {
      return { success: false, error: 'Insufficient tokens' };
    }

    // Calculate transaction amounts
    const price = listing.price;
    const burnAmount = calculateMarketplaceBurn(price);
    const platformFee = Math.floor((price * MARKETPLACE_PLATFORM_FEE_BP) / 10000);
    const sellerReceives = price - burnAmount - platformFee;

    // Execute transaction atomically (simplified - in production use RPC)
    
    // 1. Deduct from buyer
    const { error: buyerUpdateError } = await this.supabase
      .from('profiles')
      .update({
        token_balance: buyerProfile.token_balance - price,
      })
      .eq('id', buyerId)
      .eq('token_balance', buyerProfile.token_balance);

    if (buyerUpdateError) {
      return { success: false, error: 'Transaction failed - buyer balance' };
    }

    // 2. Add to seller
    const { data: sellerProfile, error: sellerError } = await this.supabase
      .from('profiles')
      .select('id, token_balance')
      .eq('id', listing.seller_id)
      .single();

    if (sellerError || !sellerProfile) {
      // Refund buyer
      await this.supabase
        .from('profiles')
        .update({
          token_balance: buyerProfile.token_balance,
        })
        .eq('id', buyerId);
      
      return { success: false, error: 'Seller not found' };
    }

    await this.supabase
      .from('profiles')
      .update({
        token_balance: sellerProfile.token_balance + sellerReceives,
      })
      .eq('id', listing.seller_id);

    // 3. Transfer ticket ownership
    await this.supabase
      .from('tickets')
      .update({
        owner_id: buyerId,
        marketplace_listing_id: null,
      })
      .eq('id', listing.ticket_id);

    // 4. Update buyer's ticket list
    let buyerTickets: string[] = [];
    if (buyerProfile.owned_ticket_ids) {
      try {
        buyerTickets = typeof buyerProfile.owned_ticket_ids === 'string'
          ? JSON.parse(buyerProfile.owned_ticket_ids)
          : buyerProfile.owned_ticket_ids;
      } catch {
        buyerTickets = [];
      }
    }
    buyerTickets.push(listing.ticket_id);

    await this.supabase
      .from('profiles')
      .update({ owned_ticket_ids: JSON.stringify(buyerTickets) })
      .eq('id', buyerId);

    // 5. Mark listing as completed
    await this.supabase
      .from('ticket_marketplace')
      .update({
        completed_at: new Date(now).toISOString(),
      })
      .eq('id', listingId);

    // 6. Track transaction
    const transaction: MarketplaceTransaction = {
      id: `txn_${Date.now()}`,
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      price: price,
      burn_amount: burnAmount,
      platform_fee: platformFee,
      seller_receives: sellerReceives,
      completed_at: now,
    };

    await this.recordTransaction(transaction);

    // Update metrics
    await this.updateMetrics('tickets_sold', 1);
    await this.updateMetrics('marketplace_volume', price);
    await this.updateMetrics('tokens_burned', burnAmount);

    return { success: true, transaction };
  }

  /**
   * Get active listings
   */
  async getActiveListings(): Promise<MarketplaceListing[]> {
    const { data, error } = await this.supabase
      .from('ticket_marketplace')
      .select(`
        *,
        tickets: ticket_id (*),
        profiles: seller_id (username, avatar_url)
      `)
      .is('completed_at', null)
      .order('listed_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((listing: any) => ({
      id: listing.id,
      ticket_id: listing.ticket_id,
      seller_id: listing.seller_id,
      seller_username: listing.profiles?.username,
      price: listing.price,
      listed_at: new Date(listing.listed_at).getTime(),
      ticket_activated: listing.tickets?.is_activated || false,
      ticket_expires_at: listing.tickets?.expires_at 
        ? new Date(listing.tickets.expires_at).getTime() 
        : undefined,
    }));
  }

  /**
   * Get user's listings
   */
  async getUserListings(userId: string): Promise<MarketplaceListing[]> {
    const { data, error } = await this.supabase
      .from('ticket_marketplace')
      .select(`
        *,
        tickets: ticket_id (*)
      `)
      .eq('seller_id', userId)
      .is('completed_at', null);

    if (error || !data) {
      return [];
    }

    return data.map((listing: any) => ({
      id: listing.id,
      ticket_id: listing.ticket_id,
      seller_id: listing.seller_id,
      price: listing.price,
      listed_at: new Date(listing.listed_at).getTime(),
      ticket_activated: listing.tickets?.is_activated || false,
      ticket_expires_at: listing.tickets?.expires_at 
        ? new Date(listing.tickets.expires_at).getTime() 
        : undefined,
    }));
  }

  /**
   * Record transaction for audit
   */
  private async recordTransaction(
    transaction: MarketplaceTransaction
  ): Promise<void> {
    await this.supabase
      .from('marketplace_transactions')
      .insert({
        listing_id: transaction.listing_id,
        buyer_id: transaction.buyer_id,
        seller_id: transaction.seller_id,
        price: transaction.price,
        burn_amount: transaction.burn_amount,
        platform_fee: transaction.platform_fee,
        seller_receives: transaction.seller_receives,
        completed_at: new Date(transaction.completed_at).toISOString(),
      });
  }

  /**
   * Update economy metrics
   */
  private async updateMetrics(
    field: string,
    value: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const updateFields: any = {};
    updateFields[field] = value;

    await this.supabase
      .from('economy_metrics')
      .upsert({
        date: today,
        ...updateFields,
      }, {
        onConflict: 'date',
        ignoreDuplicates: false
      });
  }
}

/**
 * Factory function
 */
export function createMarketplaceService(supabaseClient: any): MarketplaceService {
  return new MarketplaceService(supabaseClient);
}

