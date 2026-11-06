"use client";

import { useEffect, useState } from "react";
import { formatPrice, loadDealsFeed, type Plan } from "./lib/deals";
import { getRecentVintedSearches, type RecentVintedSearch } from "./lib/search-history";

export default function Home() {
  const [savedCount,setSavedCount]=useState(0);
  const [plan, setPlan] = useState<Plan>("FREE");
  const [recentSearches,setRecentSearches]=useState<RecentVintedSearch[]>([]);
  useEffect(() => {void loadDealsFeed().then(feed=>setPlan(feed.plan));void fetch("/api/saved-deals",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(Array.isArray(data?.saved))setSavedCount(data.saved.length)}).catch(()=>{});const refresh=()=>setRecentSearches(getRecentVintedSearches());refresh();window.addEventListener("vs-search-history-change",refresh);return()=>window.removeEventListener("vs-search-history-change",refresh)}, []);

  return <main className="page-wrap">
    <section className="hero-panel">
      <div className="hero-copy"><div className="eyebrow"><i /> VINTED DEAL HUNTER · {plan} PLAN</div><h1>Your next great <em>deal</em> starts here.</h1><p>Search fresh Vinted listings, save deals, and find a better price.</p><div className="hero-actions"><a className="button-primary" href="/deal-hunter">Open Deal Hunter <span>↗</span></a><a className="button-secondary" href="/price-watch">Price Watch →</a></div></div>
      <div className="hero-art"><div className="art-sun"/><div className="art-tag">VINTED<br/><b>SNIPER</b></div><div className="art-caption">SECOND HAND<br/>FIRST CHOICE</div><span className="art-star">✳</span></div>
    </section>

    <a className="first-month-banner" href="/premium"><span>LIMITED FIRST-MONTH OFFER</span><strong>Pro for {formatPrice(499,"HUF")} · Premium for {formatPrice(999,"HUF")}</strong><small>Then regular monthly pricing · View plans ↗</small></a>
    <section className="stats-row">
      <article><small>YOUR SAVED DEALS</small><strong>{savedCount.toString().padStart(2,"0")}</strong><span><a href="/price-watch">Open saved products ↗</a></span></article>
      <article><small>CURRENT PLAN</small><strong>{plan}</strong><span><a href="/premium">View plans ↗</a></span></article>
      <article><small>VINTED SEARCH</small><strong>LIVE</strong><span>Latest listings on Vinted</span></article>
    </section>

    <section className="section-block recent-search-section" id="recent-searches"><div className="section-title"><div><div className="eyebrow"><i/> LATEST VINTED SEARCHES</div><h2>Searches you opened</h2></div><a className="plain-button" href="/recent-searches">All searches ↗</a></div>{recentSearches.length?<div className="recent-search-grid">{recentSearches.slice(0,4).map(item=><a className="recent-search-card" href={item.url} target="_blank" rel="noreferrer" key={`${item.query}-${item.openedAt}`}><small>{item.category} · {new Date(item.openedAt).toLocaleString()}</small><strong>{item.query}</strong><span>Open Vinted ↗</span></a>)}</div>:<div className="empty-card"><strong>Your searches will appear here.</strong><span>Open a search in Deal Hunter and it will be saved to this list.</span></div>}</section>

    <section className="section-block faq-section">
      <div className="section-title"><div><div className="eyebrow"><i/> HELP CENTER</div><h2>❓ Frequently Asked Questions</h2></div></div>
      <div className="faq-list">
        <details><summary>What is Vinted Sniper?</summary><p>An independent project being developed to organize second-hand deals.</p></details>
        <details><summary>Is this the official Vinted app?</summary><p>No. Vinted Sniper is not affiliated with Vinted.</p></details>
        <details><summary>Are the products shown on the site real Vinted listings?</summary><p>Currently, the website displays sample product data, not live Vinted listings.</p></details>
        <details><summary>Does the Deal Score verify that a product is authentic?</summary><p>No. It is an informational score only and does not authenticate products.</p></details>
        <details><summary>Does the site buy items or pay for them on my behalf?</summary><p>No. Vinted Sniper does not purchase products or handle payments for them.</p></details>
        <details><summary>Are Discord notifications working yet?</summary><p>Deal alerts and price-drop notifications are sent to the matching Free, Pro, and Premium Discord channels when the scheduled feed detects them.</p></details>
        <details><summary>Where can I get help?</summary><p>Write in the #help channel. Never send your password or sign-in code on Discord.</p></details>
      </div>
    </section>
    <footer className="page-footer"><span>VINTED SNIPER <i>•</i> SMARTER FINDS</span><span>ALL PURCHASES TAKE PLACE ON VINTED</span></footer>
  </main>;
}
