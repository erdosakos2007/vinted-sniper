"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatPrice } from "../lib/deals";
type Listing = { id: string; title: string; brand?: string; price_huf: number; description?: string; listing_url: string; image_url?: string; expires_at: number };
const durations = [{ days: 1, fee: 200 }, { days: 3, fee: 300 }, { days: 7, fee: 700 }, { days: 14, fee: 1400 }, { days: 30, fee: 3000 }, { days: 60, fee: 6000 }];
const money = (value: number) => formatPrice(value, "HUF");

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [duration, setDuration] = useState(7);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/marketplace/listings").then((r) => r.ok ? r.json() : { listings: [] }).then((d: { listings?: Listing[] }) => setListings(d.listings ?? [])).catch(() => setListings([])); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()); payload.duration = String(duration);
    try {
      const response = await fetch("/api/marketplace/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { checkoutUrl?: string; message?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.message || "Could not start checkout.");
      window.location.assign(data.checkoutUrl);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); setBusy(false); }
  }
  return <main className="page-wrap subpage-wrap">
    <section className="page-heading"><div className="eyebrow"><i/> VINTED SNIPER · LISTINGS</div><h1>Marketplace <em>listings.</em></h1><p>Promote your Vinted listing. Choose how long it stays visible, pay online, and it will appear after payment.</p></section>
    <div className="notice-banner"><span>ℹ</span><p>Payment will be handled by Stripe. Listings are published only after successful payment. Stripe is not connected to this new Cloudflare project yet.</p></div>
    <section className="section-block marketplace-form-section"><div className="section-title"><div><div className="eyebrow"><i/> NEW LISTING</div><h2>Listing details</h2></div></div>
      <form className="add-deal-form marketplace-form" onSubmit={submit}>
        <label>Product name<input name="title" required maxLength={120} placeholder="For example: Ralph Lauren sweater"/></label>
        <label>Brand<input name="brand" maxLength={60} placeholder="For example: Ralph Lauren"/></label>
        <label>Asking price (HUF)<input name="price" required type="number" min="1" max="100000000" placeholder="12000"/></label>
        <label>Email address<input name="email" required type="email" maxLength={254} placeholder="name@email.com"/></label>
        <label className="field-wide">Vinted listing URL<input name="url" required type="url" placeholder="https://www.vinted.hu/items/…"/></label>
        <label className="field-wide">Image URL (optional)<input name="imageUrl" type="url" placeholder="https://…"/></label>
        <label className="field-wide">Description (optional)<textarea name="description" maxLength={1000} rows={3} placeholder="Briefly describe the item's condition…"/></label>
        <div className="field-wide"><span className="duration-label">Listing duration</span><div className="duration-grid">{durations.map((item) => <button type="button" key={item.days} onClick={() => setDuration(item.days)} className={`duration-option${duration === item.days ? " selected" : ""}`}><strong>{item.days} days</strong><small>{money(item.fee)}</small></button>)}</div></div>
        <button className="button-primary field-wide marketplace-submit" type="submit" disabled={busy}>{busy ? "Starting checkout…" : `${money(durations.find((item) => item.days === duration)!.fee)} · Continue to payment`} <span>→</span></button>
      </form>
      {message && <p className="form-message marketplace-message" role="alert">{message}</p>}
      <p className="small-note">The Marketplace owner needs a Stripe account to accept payments. Card details are never collected on this site.</p>
    </section>
    <section className="section-block"><div className="section-title"><div><div className="eyebrow"><i/> PUBLISHED LISTINGS</div><h2>Marketplace</h2></div></div>
      {listings.length ? <div className="deal-list">{listings.map((item) => <a className="deal-row" href={item.listing_url} target="_blank" rel="noreferrer" key={item.id}><span className="deal-image">{item.image_url ? <img src={item.image_url} alt=""/> : <b>V</b>}</span><span className="deal-name"><small>{item.brand || "VINTED"}</small><strong>{item.title}</strong></span><strong className="deal-price">{money(item.price_huf)}</strong><span className="deal-open">Open ↗</span></a>)}</div> : <div className="empty-card"><strong>No active listings yet.</strong><span>Successfully paid listings will appear here until they expire.</span></div>}
    </section>
  </main>;
}
