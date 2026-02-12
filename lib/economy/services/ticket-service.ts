/**
 * TICKET SERVICE
 * 
 * Handles NFT-ready ticket subscriptions.
 * Tickets are created through real-money purchases only.
 * Can be held, transferred, or activated.
 */

import { createClient } from '@/lib/supabase/server';
import {
  UserEconomyState,
  Ticket,
  ApiResponse,
} from '../types';
import { TICKET_SUBSCRIPTION_DAYS } from '../constants';

export class TicketService {
  private supabase: any;
  private userId: string;

  constructor(supabaseClient: any, userId: string) {
    this.supabase = supabaseClient;
    this.userId = userId;
  }

  /**
   * Get user's owned tickets
   */
  async getUserTickets(): Promise<Ticket[]> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('owner_id', this.userId)
      .order('issued_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((ticket: any) => ({
      id: ticket.id,
      owner_id: ticket.owner_id,
      is_activated: ticket.is_activated,
      issued_at: new Date(ticket.issued_at).getTime(),
      activated_at: ticket.activated_at ? new Date(ticket.activated_at).getTime() : null,
      expires_at: ticket.expires_at ? new Date(ticket.expires_at).getTime() : null,
      blockchain_token_id: ticket.blockchain_token_id,
      marketplace_listing_id: ticket.marketplace_listing_id,
    }));
  }

  /**
   * Activate a ticket for subscription
   * Returns subscription expiry timestamp
   */
  async activateTicket(ticketId: string): Promise<{
    success: boolean;
    subscription_expiry?: number;
    error?: string;
  }> {
    // Get ticket
    const { data: ticket, error: ticketError } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('owner_id', this.userId)
      .single();

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    // Validate ticket
    if (ticket.is_activated) {
      return { success: false, error: 'Ticket already activated' };
    }

    if (ticket.marketplace_listing_id) {
      return { success: false, error: 'Cannot activate listed ticket' };
    }

    // Calculate expiry (30 days from now)
    const now = Date.now();
    const expiry = now + (TICKET_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

    // Activate ticket and update subscription
    const { error: updateError } = await this.supabase
      .from('tickets')
      .update({
        is_activated: true,
        activated_at: new Date(now).toISOString(),
        expires_at: new Date(expiry).toISOString(),
      })
      .eq('id', ticketId)
      .eq('owner_id', this.userId);

    if (updateError) {
      return { success: false, error: 'Failed to activate ticket' };
    }

    // Update user's subscription
    const { error: profileError } = await this.supabase
      .from('profiles')
      .update({ subscription_expiry: expiry })
      .eq('id', this.userId);

    if (profileError) {
      return { success: false, error: 'Failed to update subscription' };
    }

    return { success: true, subscription_expiry: expiry };
  }

  /**
   * Create a new ticket (admin only - real money purchase)
   * This should only be called from payment webhook
   */
  async createTicket(
    ownerId: string,
    blockchainTokenId?: string
  ): Promise<Ticket | null> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('tickets')
      .insert({
        owner_id: ownerId,
        is_activated: false,
        issued_at: now,
        blockchain_token_id: blockchainTokenId,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create ticket:', error);
      return null;
    }

    // Update user's owned_tickets array
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('owned_ticket_ids')
      .eq('id', ownerId)
      .single();

    let ticketIds: string[] = [];
    if (profile?.owned_ticket_ids) {
      try {
        ticketIds = typeof profile.owned_ticket_ids === 'string'
          ? JSON.parse(profile.owned_ticket_ids)
          : profile.owned_ticket_ids;
      } catch {
        ticketIds = [];
      }
    }

    ticketIds.push(data.id);

    await this.supabase
      .from('profiles')
      .update({ owned_ticket_ids: JSON.stringify(ticketIds) })
      .eq('id', ownerId);

    return {
      id: data.id,
      owner_id: data.owner_id,
      is_activated: data.is_activated,
      issued_at: new Date(data.issued_at).getTime(),
      activated_at: null,
      expires_at: null,
      blockchain_token_id: data.blockchain_token_id,
    };
  }

  /**
   * Transfer ticket to another user
   */
  async transferTicket(
    ticketId: string,
    recipientId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Get ticket
    const { data: ticket, error: ticketError } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('owner_id', this.userId)
      .single();

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    if (ticket.is_activated) {
      return { success: false, error: 'Cannot transfer activated ticket' };
    }

    if (ticket.marketplace_listing_id) {
      return { success: false, error: 'Cannot transfer listed ticket' };
    }

    // Transfer ownership
    const { error: updateError } = await this.supabase
      .from('tickets')
      .update({ owner_id: recipientId })
      .eq('id', ticketId);

    if (updateError) {
      return { success: false, error: 'Transfer failed' };
    }

    // Update sender's ticket list
    const { data: senderProfile } = await this.supabase
      .from('profiles')
      .select('owned_ticket_ids')
      .eq('id', this.userId)
      .single();

    if (senderProfile?.owned_ticket_ids) {
      try {
        let senderTickets = typeof senderProfile.owned_ticket_ids === 'string'
          ? JSON.parse(senderProfile.owned_ticket_ids)
          : senderProfile.owned_ticket_ids;
        
        senderTickets = senderTickets.filter((id: string) => id !== ticketId);

        await this.supabase
          .from('profiles')
          .update({ owned_ticket_ids: JSON.stringify(senderTickets) })
          .eq('id', this.userId);
      } catch {
        // Ignore parse errors
      }
    }

    // Update recipient's ticket list
    const { data: recipientProfile } = await this.supabase
      .from('profiles')
      .select('owned_ticket_ids')
      .eq('id', recipientId)
      .single();

    let recipientTickets: string[] = [];
    if (recipientProfile?.owned_ticket_ids) {
      try {
        recipientTickets = typeof recipientProfile.owned_ticket_ids === 'string'
          ? JSON.parse(recipientProfile.owned_ticket_ids)
          : recipientProfile.owned_ticket_ids;
      } catch {
        recipientTickets = [];
      }
    }

    recipientTickets.push(ticketId);

    await this.supabase
      .from('profiles')
      .update({ owned_ticket_ids: JSON.stringify(recipientTickets) })
      .eq('id', recipientId);

    return { success: true };
  }

  /**
   * Check subscription status
   */
  async getSubscriptionStatus(): Promise<{
    isActive: boolean;
    expiresAt: number | null;
    daysRemaining: number;
  }> {
    const { data } = await this.supabase
      .from('profiles')
      .select('subscription_expiry')
      .eq('id', this.userId)
      .single();

    if (!data?.subscription_expiry) {
      return { isActive: false, expiresAt: null, daysRemaining: 0 };
    }

    const now = Date.now();
    const expiry = data.subscription_expiry;
    const isActive = now < expiry;
    const daysRemaining = isActive
      ? Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
      : 0;

    return { isActive, expiresAt: expiry, daysRemaining };
  }
}

/**
 * Factory function
 */
export function createTicketService(supabaseClient: any, userId: string): TicketService {
  return new TicketService(supabaseClient, userId);
}

