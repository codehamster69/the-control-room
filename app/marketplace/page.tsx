"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface MarketplaceTicket {
  ticket_id: string;
  status: string;
  created_at: string;
}

export default function MarketplacePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<MarketplaceTicket[]>([]);
  const [currency, setCurrency] = useState('usd');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [transferTicketId, setTransferTicketId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [priceTokens, setPriceTokens] = useState(0);

  const loadTickets = async () => {
    const response = await fetch('/api/marketplace/tickets', { cache: 'no-store' });
    const data = await response.json();
    if (data.success) {
      setTickets(data.tickets ?? []);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }

      await loadTickets();
      setLoading(false);
    };

    init();
  }, []);

  const startCheckout = async () => {
    setMessage('Creating secure checkout session...');
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, currency }),
    });

    const data = await response.json();
    if (!data.success) {
      setMessage(data.error ?? 'Failed to create checkout session');
      return;
    }

    window.location.href = data.checkoutUrl;
  };

  const redeemTicket = async (ticketId: string) => {
    const response = await fetch('/api/marketplace/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', ticketId }),
    });

    const data = await response.json();
    if (!data.success) {
      setMessage(data.error ?? 'Redeem failed');
      return;
    }

    setMessage('Ticket redeemed. Subscription expiry updated successfully.');
    await loadTickets();
  };

  const transferTicket = async () => {
    const response = await fetch('/api/marketplace/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'transfer',
        ticketId: transferTicketId,
        buyerId,
        priceTokens,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      setMessage(data.error ?? 'Transfer failed');
      return;
    }

    setMessage(priceTokens === 0 ? 'Gift completed successfully.' : 'Trade completed successfully.');
    setTransferTicketId('');
    setBuyerId('');
    setPriceTokens(0);
    await loadTickets();
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-cyan-400 p-8">Loading marketplace...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Link href="/hunt" className="underline">Back</Link>
      </div>

      <section className="border border-zinc-700 rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Buy Tickets (Fiat)</h2>
        <p className="text-sm text-zinc-400">Uses Stripe Checkout. Tickets are minted only after verified payment webhook.</p>
        <div className="flex gap-3">
          <input className="bg-zinc-900 border border-zinc-700 rounded px-2" type="number" min={1} max={25} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <select className="bg-zinc-900 border border-zinc-700 rounded px-2" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
            <option value="gbp">GBP</option>
            <option value="inr">INR</option>
          </select>
          <button className="bg-cyan-600 px-4 py-2 rounded" onClick={startCheckout}>Checkout</button>
        </div>
      </section>

      <section className="border border-zinc-700 rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">My Tickets</h2>
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.ticket_id} className="border border-zinc-800 rounded p-3 flex items-center justify-between">
              <div>
                <div className="text-sm">{ticket.ticket_id}</div>
                <div className="text-xs text-zinc-400">Status: {ticket.status}</div>
              </div>
              {ticket.status === 'owned' ? (
                <button className="bg-emerald-600 px-3 py-1 rounded" onClick={() => redeemTicket(ticket.ticket_id)}>Redeem 1 month</button>
              ) : null}
            </div>
          ))}
          {tickets.length === 0 ? <p className="text-zinc-500 text-sm">No tickets owned yet.</p> : null}
        </div>
      </section>

      <section className="border border-zinc-700 rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Trade / Gift</h2>
        <p className="text-sm text-zinc-400">Set token price to 0 to gift.</p>
        <div className="grid gap-2 max-w-2xl">
          <input placeholder="Ticket ID" value={transferTicketId} onChange={(e) => setTransferTicketId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
          <input placeholder="Buyer user UUID" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
          <input placeholder="Price in tokens" type="number" min={0} value={priceTokens} onChange={(e) => setPriceTokens(Number(e.target.value))} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
          <button className="bg-fuchsia-600 px-4 py-2 rounded w-fit" onClick={transferTicket}>Execute transfer</button>
        </div>
      </section>

      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
    </div>
  );
}
