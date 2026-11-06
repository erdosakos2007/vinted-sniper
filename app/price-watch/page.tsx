"use client";

import { useEffect, useState } from "react";
import { formatPrice, loadDealsFeed, type Plan } from "../lib/deals";
import { makeVintedSearch } from "../lib/vinted-search";
import { recordVintedSearch } from "../lib/search-history";

type Saved = { id:string;title:string;brand:string|null;price:number;currency:"HUF"|"EUR";url:string;image_url:string|null };
type Alert = { id:string;dealId:string;title:string;previousPrice:number;currentPrice:number;currency:"HUF"|"EUR";url:string;detectedAt:string };

export default function PriceWatch() {
  const [plan,setPlan]=useState<Plan>("FREE");const [saved,setSaved]=useState<Saved[]>([]);const [alerts,setAlerts]=useState<Alert[]>([]);const [query,setQuery]=useState("");const [message,setMessage]=useState("");const [updated,setUpdated]=useState("");
  async function refresh(){const [feed,response]=await Promise.all([loadDealsFeed(),fetch("/api/saved-deals",{cache:"no-store"})]);setPlan(feed.plan);const data=await response.json().catch(()=>null);if(response.ok){setSaved(Array.isArray(data?.saved)?data.saved:[]);setAlerts(Array.isArray(data?.alerts)?data.alerts:[]);setMessage("")}else setMessage(data?.message||"Sign in to save products and see their price-drop alerts.");setUpdated(new Date().toLocaleTimeString())}
  useEffect(()=>{let active=true;const run=async()=>{if(!active)return;await refresh()};void run();const timer=window.setInterval(()=>void run(),plan==="PREMIUM"?120000:plan==="PRO"?300000:600000);return()=>{active=false;window.clearInterval(timer)}},[plan]);
  function search(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(query.trim().length<2)return;const url=makeVintedSearch(query.trim());recordVintedSearch(query.trim(),"All categories",url);window.open(url,"_blank","noopener,noreferrer")}
  async function remove(id:string){const response=await fetch(`/api/saved-deals?id=${encodeURIComponent(id)}`,{method:"DELETE"});if(response.ok)setSaved(current=>current.filter(item=>item.id!==id));else setMessage("Could not remove the saved listing.")}
  return <main className="page-wrap subpage-wrap">
    <section className="page-heading"><div className="eyebrow"><i/> PRICE WATCH · {plan} PLAN</div><h1>Track a deal.<br/><em>Catch the price drop.</em></h1><p>Save a listing in Deal Hunter and we’ll show it here when its price falls.</p><p className="small-note">Checks every {plan==="PREMIUM"?"2 minutes":plan==="PRO"?"5 minutes":"10 minutes"} · Last checked: {updated||"Loading…"}</p></section>
    <form className="watch-search" onSubmit={search}><label htmlFor="watch-query">SEARCH VINTED</label><div><span>⌕</span><input id="watch-query" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ralph Lauren sweater, Nike jacket…" maxLength={80}/><button className="button-primary" type="submit" disabled={query.trim().length<2}>Search Vinted ↗</button></div></form>
    {message&&<div className="notice-banner"><span>ℹ</span><p>{message} <a href="/account">Log in / register →</a></p></div>}
    <section className="section-block deals-block"><div className="section-title"><div><div className="eyebrow"><i/> PRICE DROP ALERTS</div><h2>Price reductions <span className="count-pill">{alerts.length}</span></h2></div></div>
      {alerts.length?<div className="deal-list">{alerts.map(alert=><div className="deal-row price-drop-row" key={alert.id}><span className="deal-image"><b>↓</b></span><span className="deal-name"><small>PRICE DROPPED · {new Date(alert.detectedAt).toLocaleString()}</small><a href={alert.url} target="_blank" rel="noreferrer"><strong>{alert.title}</strong></a></span><strong className="deal-price"><s>{formatPrice(alert.previousPrice,alert.currency)}</s><br/>{formatPrice(alert.currentPrice,alert.currency)}</strong><span className="drop-badge">-{Math.max(0,Math.round((1-alert.currentPrice/alert.previousPrice)*100))}%</span></div>)}</div>:<div className="empty-card"><strong>No price drops yet.</strong><span>When a saved listing gets cheaper, its old and new prices will appear here.</span></div>}
    </section>
    <section className="section-block deals-block"><div className="section-title"><div><div className="eyebrow"><i/> YOUR SAVED PRODUCTS</div><h2>Watched listings <span className="count-pill">{saved.length}</span></h2></div></div>
      {saved.length?<div className="deal-list">{saved.map(item=><div className="deal-row" key={item.id}><span className="deal-image">{item.image_url?<img src={item.image_url} alt=""/>:<b>V</b>}</span><span className="deal-name"><small>{item.brand||"VINTED"}</small><a href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong></a></span><strong className="deal-price">{formatPrice(item.price,item.currency)}</strong><button className="deal-save-button" onClick={()=>void remove(item.id)}>Remove</button></div>)}</div>:<div className="empty-card"><strong>No watched products yet.</strong><span>Sign in, open Deal Hunter, and press “Save” next to a listing.</span><a href="/deal-hunter">Open Deal Hunter →</a></div>}
    </section>
  </main>;
}
