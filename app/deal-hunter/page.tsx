"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { formatPrice, loadDeals, loadDealsFeed, submitDeal, visibleDeals, type LockedCounts, type Plan, type VintedDeal } from "../lib/deals";
import { makeVintedSearch, vintedCategories } from "../lib/vinted-search";
import { recordVintedSearch } from "../lib/search-history";

export default function DealHunter() {
  const [deals, setDeals] = useState<VintedDeal[]>([]);
  const [plan, setPlan] = useState<Plan>("FREE");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [lockedCounts, setLockedCounts] = useState<LockedCounts>({ plus: 0, premium: 0 });
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => { let alive=true;const refresh=async()=>{const feed=await loadDealsFeed();if(alive){setDeals(feed.deals);setPlan(feed.plan);setLockedCounts(feed.lockedCounts);setLastUpdated(new Date().toLocaleTimeString())}};void refresh();const interval=window.setInterval(()=>void refresh(),plan==="PREMIUM"?120000:plan==="PRO"?300000:600000);return()=>{alive=false;window.clearInterval(interval)}; }, [plan]);
  useEffect(()=>{void fetch("/api/saved-deals",{cache:"no-store"}).then(async r=>r.ok?r.json():null).then(d=>{if(Array.isArray(d?.saved))setSavedIds(new Set(d.saved.map((x: {id:string})=>x.id)))}).catch(()=>{});},[]);
  const filtered = useMemo(() => deals.filter((deal) => `${deal.title} ${deal.brand}`.toLocaleLowerCase("hu").includes(query.trim().toLocaleLowerCase("hu"))), [deals, query]);
  const shown = useMemo(() => visibleDeals(filtered, plan), [filtered, plan]);

  function addDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let listingUrl: URL;
    try { listingUrl = new URL(url); } catch { setMessage("Enter a valid Vinted listing URL."); return; }
    if (listingUrl.protocol !== "https:" || !/(^|\.)vinted\.[a-z.]+$/i.test(listingUrl.hostname)) { setMessage("The link must point to a Vinted listing."); return; }
    let safeImage = "";
    if (imageUrl.trim()) {
      try { const parsed = new URL(imageUrl); if (parsed.protocol === "https:" && /(^|\.)vinted\.(net|com)$/i.test(parsed.hostname)) safeImage = parsed.toString(); }
      catch { /* An invalid optional image is omitted. */ }
    }
    const deal: VintedDeal = { id: crypto.randomUUID(), title: title.trim(), brand: brand.trim(), price: Number(price), currency: "HUF", url: listingUrl.toString(), imageUrl: safeImage, createdAt: Date.now() };
    void submitDeal(deal).then(async () => { setDeals(await loadDeals()); setTitle(""); setBrand(""); setPrice(""); setUrl(""); setImageUrl(""); setMessage("Saved to the shared deals list."); })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not save the deal."));
  }

  async function toggleSaved(deal: VintedDeal) {
    const wasSaved=savedIds.has(deal.id);
    try {
      const response=await fetch(wasSaved?`/api/saved-deals?id=${encodeURIComponent(deal.id)}`:"/api/saved-deals",wasSaved?{method:"DELETE"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(deal)});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.message||"Sign in to save products and track price drops.");
      setSavedIds(current=>{const next=new Set(current);if(wasSaved)next.delete(deal.id);else next.add(deal.id);return next;});
      setMessage(wasSaved?"Removed from your saved products.":"Saved. We’ll show an alert here if the price drops.");
    } catch(error) { setMessage(error instanceof Error?error.message:"Could not save this product."); }
  }

  return <main className="page-wrap subpage-wrap">
    <section className="page-heading"><div className="eyebrow"><i/> DEAL HUNTER · {plan} PLAN</div><h1>Vinted deals,<br/><em>all in one place.</em></h1><p>Search Vinted, then save the listings you want to keep an eye on.</p><p className="small-note">Auto-refreshes every {plan==="PREMIUM"?"2 minutes":plan==="PRO"?"5 minutes":"10 minutes"} · Last updated: {lastUpdated||"Loading…"}</p></section>
    <form className="search-panel" onSubmit={(event) => { event.preventDefault(); const href = makeVintedSearch(query, category);recordVintedSearch(query,vintedCategories.find(item=>item.id===category)?.label||"All categories",href);window.open(href, "_blank", "noopener,noreferrer"); }}>
      <div className="search-panel-label"><span>01</span><label htmlFor="deal-query">WHAT ARE YOU LOOKING FOR?</label></div>
      <input id="deal-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ralph Lauren sweater, Nike shoes…" maxLength={80}/>
      <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>{vintedCategories.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
      <button className="button-primary" type="submit" disabled={!query.trim()}>Search Vinted ↗</button>
    </form>
    <div className="plan-hint"><span>{plan}</span>{plan === "FREE" ? "Free shows up to 2 free-tier deals." : plan === "PRO" ? "Pro shows up to 6 free and Plus deals." : "Premium shows all available deals, starting with the lowest prices."}<a href="/premium">Change plan ↗</a></div>

    <section className="section-block deals-block"><div className="section-title"><div><div className="eyebrow"><i/> SHARED VINTED LIST</div><h2>Current deals <span className="count-pill">{shown.length}</span></h2></div></div>
      {shown.length ? <div className="deal-list">{shown.map((deal) => <div className="deal-row" key={deal.id}><span className="deal-image">{deal.imageUrl ? <img src={deal.imageUrl} alt=""/> : <b>V</b>}</span><span className="deal-name"><small>{deal.brand || "VINTED"}</small><a href={deal.url} target="_blank" rel="noreferrer"><strong>{deal.title}</strong></a></span><strong className="deal-price">{formatPrice(deal.price, deal.currency)}</strong><a className="deal-open-link" href={deal.url} target="_blank" rel="noreferrer">Open ↗</a><button type="button" className={`deal-save-button${savedIds.has(deal.id)?" saved":""}`} onClick={()=>void toggleSaved(deal)}>{savedIds.has(deal.id)?"Saved ♥":"Save ♡"}</button></div>)}</div> : <div className="empty-card"><strong>No deals yet.</strong><span>New listings from the configured source will appear here.</span></div>}
      {((plan === "FREE" && (lockedCounts.plus + lockedCounts.premium > 0)) || (plan === "PRO" && lockedCounts.premium > 0)) && <div className="locked-previews" aria-label="Locked plan previews">
        {plan === "FREE" && lockedCounts.plus > 0 && <article className="locked-preview"><span className="locked-preview-art">✦</span><div><small>PLUS · {lockedCounts.plus} {lockedCounts.plus === 1 ? "deal" : "deals"}</small><strong>More member-only finds</strong><p>Upgrade to Plus or Premium to view these listings.</p></div><a className="button-secondary" href="/premium">View plans ↗</a></article>}
        {lockedCounts.premium > 0 && <article className="locked-preview premium"><span className="locked-preview-art">✦</span><div><small>PREMIUM · {lockedCounts.premium} {lockedCounts.premium === 1 ? "deal" : "deals"}</small><strong>Premium picks</strong><p>Upgrade to Premium to unlock these listings.</p></div><a className="button-secondary" href="/premium">View plans ↗</a></article>}
      </div>}
    </section>

    <details className="add-deal"><summary>Add a Vinted listing</summary><form onSubmit={addDeal} className="add-deal-form">
      <label>Product name<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example: Cable Knit sweater"/></label>
      <label>Brand<input maxLength={60} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="For example: Ralph Lauren"/></label>
      <label>Price (HUF)<input required type="number" min="1" max="10000000" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="12000"/></label>
      <label className="field-wide">Vinted listing URL<input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.vinted.hu/items/…"/></label>
      <label className="field-wide">Image URL (optional)<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="HTTPS link to the Vinted image"/></label>
      <button className="button-primary field-wide" type="submit">Save deal <span>→</span></button>
    </form>{message && <p className="form-message" role="status">{message}</p>}<p className="small-note">Saved deals are shared on this site. Vinted shows the current search results on its own website.</p></details>
  </main>;
}
