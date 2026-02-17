/**
 * TICKET MARKETPLACE API
 * GET /api/economy/marketplace - Get listings
 * POST /api/economy/marketplace - List/buy ticket
 */

import { createClient } from '@/lib/supabase/server';
import { createMarketplaceService } from '@/lib/economy/services/marketplace-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const marketplaceService = createMarketplaceService(supabase);
    
    // Get query params
    const { searchParams } = new URL(request.url);
    const myListingsOnly = searchParams.get('my_listings') === 'true';

    let listings;
    if (myListingsOnly) {
      listings = await marketplaceService.getUserListings(user.id);
    } else {
      listings = await marketplaceService.getActiveListings();
    }

    return NextResponse.json({
      success: true,
      listings,
    });
  } catch (error) {
    console.error('Marketplace GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Instagram verification
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_instagram_verified')
      .eq('id', user.id)
      .single();

    if (!profile?.is_instagram_verified) {
      return NextResponse.json(
        { success: false, error: 'Instagram verification required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, ticket_id, price, listing_id } = body;

    const marketplaceService = createMarketplaceService(supabase);

    switch (action) {
      case 'list': {
        if (!ticket_id || typeof price !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Missing ticket_id or price' },
            { status: 400 }
          );
        }

        const listResult = await marketplaceService.listTicket(user.id, ticket_id, price);
        
        if (!listResult.success) {
          return NextResponse.json(
            { success: false, error: listResult.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          listing: listResult.listing,
          message: 'Ticket listed for sale!',
        });
      }

      case 'buy': {
        if (!listing_id) {
          return NextResponse.json(
            { success: false, error: 'Missing listing_id' },
            { status: 400 }
          );
        }

        const buyResult = await marketplaceService.buyTicket(user.id, listing_id);
        
        if (!buyResult.success) {
          return NextResponse.json(
            { success: false, error: buyResult.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          transaction: buyResult.transaction,
          message: 'Ticket purchased successfully!',
        });
      }

      case 'cancel': {
        if (!listing_id) {
          return NextResponse.json(
            { success: false, error: 'Missing listing_id' },
            { status: 400 }
          );
        }

        const cancelResult = await marketplaceService.cancelListing(user.id, listing_id);
        
        if (!cancelResult.success) {
          return NextResponse.json(
            { success: false, error: cancelResult.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Listing cancelled.',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Marketplace POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

