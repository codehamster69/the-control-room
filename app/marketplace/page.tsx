"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Ticket, WalletCards, ArrowLeftRight, ShieldAlert } from "lucide-react";

const FIAT_PRICE_PER_TICKET = 25;

const purchaseHistory = [
  { id: "FT-2301", qty: 2, amount: "$50.00", status: "Completed" },
  { id: "FT-2307", qty: 1, amount: "$25.00", status: "Processing" },
  { id: "FT-2314", qty: 3, amount: "$75.00", status: "Pending Payment" },
];

const incomingTradeRequests = [
  { id: "TR-318", buyer: "@nova", tickets: 1, tokenPrice: 12, status: "Awaiting Seller" },
  { id: "TR-320", buyer: "@kairo", tickets: 2, tokenPrice: 0, status: "Gift Request" },
];

const tradeTimeline = ["Created", "Seller Confirmed", "Buyer Confirmed", "Settled/Cancelled"];

const ownedTickets = [
  { code: "TCK-0211", state: "Owned", redeemable: true },
  { code: "TCK-0249", state: "Listed", redeemable: false },
  { code: "TCK-0310", state: "Locked", redeemable: false },
];

function stateBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "Owned" || state === "Completed" || state === "Settled") return "default";
  if (state === "Locked" || state === "Processing" || state === "Awaiting Seller") return "secondary";
  if (state.includes("Cancelled")) return "destructive";
  return "outline";
}

export default function MarketplacePage() {
  const [quantity, setQuantity] = useState(1);
  const [listingPrice, setListingPrice] = useState("10");
  const subtotal = useMemo(() => quantity * FIAT_PRICE_PER_TICKET, [quantity]);

  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white md:p-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-cyan-300">Marketplace</h1>
          <p className="text-sm text-zinc-300">Buy with fiat, trade peer-to-peer in tokens, and track ticket lock/settlement stages in one place.</p>
        </header>

        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-100">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Lock & settlement warning</AlertTitle>
          <AlertDescription>
            Tickets marked <strong>Listed</strong> or <strong>Locked</strong> are temporarily unavailable while trade confirmation or settlement is in progress.
            They automatically return to <strong>Owned</strong> if a trade is cancelled.
          </AlertDescription>
        </Alert>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="border-cyan-500/30 bg-black/50 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-300"><WalletCards className="h-5 w-5" />Buy Tickets (Fiat only)</CardTitle>
              <CardDescription>Card/fiat checkout only. Token balances are not used in this section.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-zinc-300">Quantity</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>-</Button>
                  <span className="w-10 text-center text-lg font-semibold">{quantity}</span>
                  <Button variant="outline" onClick={() => setQuantity((q) => q + 1)}>+</Button>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-700 p-3">
                <p className="text-sm text-zinc-300">Price summary</p>
                <p className="text-xl font-semibold">${subtotal.toFixed(2)}</p>
                <p className="text-xs text-zinc-400">{quantity} × ${FIAT_PRICE_PER_TICKET.toFixed(2)} per ticket</p>
              </div>
              <Button className="w-full">Checkout</Button>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-black/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-300"><Ticket className="h-5 w-5" />Purchase history & status</CardTitle>
              <CardDescription>Monitor fiat orders as they move from payment to delivery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {purchaseHistory.map((purchase) => (
                <div key={purchase.id} className="flex items-center justify-between rounded-lg border border-zinc-700 p-3">
                  <div>
                    <p className="font-medium">{purchase.id}</p>
                    <p className="text-sm text-zinc-400">{purchase.qty} ticket(s) · {purchase.amount}</p>
                  </div>
                  <Badge variant={stateBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-fuchsia-500/30 bg-black/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-fuchsia-300"><ArrowLeftRight className="h-5 w-5" />Trade Panel (P2P in tokens)</CardTitle>
              <CardDescription>Create a ticket listing in token terms. Use 0 to publish a gift listing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">Set token price</label>
                <Input value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} type="number" min="0" />
                <p className="text-xs text-zinc-400">Tip: set to 0 for gift-only transfer.</p>
              </div>
              <Button>Create Listing</Button>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Incoming trade requests</p>
                {incomingTradeRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-zinc-700 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{request.id} · {request.buyer}</p>
                      <Badge variant={stateBadgeVariant(request.status)}>{request.status}</Badge>
                    </div>
                    <p className="text-sm text-zinc-400">{request.tickets} ticket(s) for {request.tokenPrice} tokens</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-fuchsia-500/30 bg-black/50">
            <CardHeader>
              <CardTitle className="text-fuchsia-300">Per-trade status timeline</CardTitle>
              <CardDescription>Each stage must complete before settlement unlocks your ticket inventory.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tradeTimeline.map((step, index) => (
                <div key={step} className="flex items-center justify-between rounded-lg border border-zinc-700 p-3">
                  <p>{index + 1}. {step}</p>
                  <Badge variant={index < 2 ? "default" : "outline"}>{index < 2 ? "Done" : "Pending"}</Badge>
                </div>
              ))}
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-100">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  While a trade is between <strong>Created</strong> and <strong>Settled/Cancelled</strong>, matching tickets stay locked to prevent double-use.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-emerald-500/30 bg-black/50">
            <CardHeader>
              <CardTitle className="text-emerald-300">My Tickets</CardTitle>
              <CardDescription>View owned inventory and redeem eligible tickets for premium time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ownedTickets.map((ticket) => (
                <div key={ticket.code} className="flex flex-col gap-3 rounded-lg border border-zinc-700 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{ticket.code}</p>
                    <Badge variant={stateBadgeVariant(ticket.state)}>{ticket.state}</Badge>
                    <Badge variant={ticket.redeemable ? "default" : "outline"}>{ticket.redeemable ? "Redeemable" : "Not Redeemable"}</Badge>
                  </div>
                  <Button disabled={!ticket.redeemable}>Redeem for 1-month premium</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
