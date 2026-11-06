"use client";

import { useEffect, useState } from "react";
import { formatPrice, type Plan } from "../lib/deals";

const plans: { id: Plan; label: string; priceHuf: number; introHuf:number; features: string[]; featured?: boolean }[] = [
  { id: "FREE", label: "Free", priceHuf: 0, introHuf:0, features: ["Search current Vinted results", "Show 2 saved deals", "See the higher-priced deals"] },
  { id: "PRO", label: "Pro", priceHuf: 2990, introHuf:499, featured: true, features: ["First month for 499 HUF equivalent", "Then 2,990 HUF equivalent per month", "Show up to 6 deals"] },
  { id: "PREMIUM", label: "Premium", priceHuf: 4990, introHuf:999, features: ["First month for 999 HUF equivalent", "Then 4,990 HUF equivalent per month", "Show all deals, lowest prices first"] },
];

export default function PremiumPage() {
  const [current, setCurrent] = useState<Plan>("FREE");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState(false);
  const [, setRatesUpdated] = useState(0);
  useEffect(() => { void fetch("/api/plans/status", { cache: "no-store" }).then(r => r.json()).then((d: {plan?:Plan;owner?:boolean}) => {setCurrent(d.plan === "PRO" || d.plan === "PREMIUM" ? d.plan : "FREE");setOwner(Boolean(d.owner));}).catch(()=>{}); }, []);
  useEffect(()=>{const currency=localStorage.getItem("vs-currency")||"HUF";if(currency==="HUF")return;void fetch(`https://api.frankfurter.dev/v1/latest?base=HUF&symbols=${currency}`).then(r=>r.ok?r.json():null).then(d=>{if(d?.rates?.[currency]){localStorage.setItem("vs-rates",JSON.stringify({...d.rates,date:d.date}));setRatesUpdated(x=>x+1)}}).catch(()=>{})},[]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("session_id"); if (!id) return; void fetch(`/api/plans/verify?session_id=${encodeURIComponent(id)}`).then(async (r) => { const d = await r.json() as { active?: boolean; plan?: Plan; message?: string }; if (d.active && d.plan) { setCurrent(d.plan); setMessage(`${d.plan} subscription is active.`); } else setMessage(d.message || "Could not verify subscription."); }).catch(() => setMessage("Could not verify subscription.")); }, []);
  async function subscribe(plan: "PRO" | "PREMIUM") {
    setBusy(true); setMessage("");
    try { const currency=localStorage.getItem("vs-currency")||"HUF";const r = await fetch("/api/plans/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, plan, currency }) }); const d = await r.json() as { checkoutUrl?: string; message?: string }; if (!r.ok || !d.checkoutUrl) throw new Error(d.message || "Could not start checkout."); window.location.assign(d.checkoutUrl); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not start checkout."); setBusy(false); }
  }

  return <main className="page-wrap subpage-wrap">
    <section className="page-heading"><div className="eyebrow"><i/> VINTED SNIPER · PLANS</div><h1>Choose what <em>works for you.</em></h1><p>Your plan controls how many saved deals you can see and how they are sorted.</p></section>
    <div className="notice-banner"><span>ℹ</span><p><strong>{owner ? "Owner access" : "Monthly subscriptions"}</strong><br/>{owner ? "Your account has Premium access to every available deal." : "Pro and Premium are billed monthly through Stripe Checkout. The Free plan remains free."}</p></div>
    {!owner && <form className="watch-search plan-checkout" onSubmit={(e) => e.preventDefault()}><label htmlFor="plan-email">EMAIL FOR YOUR SUBSCRIPTION</label><input id="plan-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/>{message && <p role="status">{message}</p>}</form>}
    <div className="plan-cards">{plans.map((plan) => <article className={`plan-card-new ${plan.featured ? "featured" : ""} ${current === plan.id ? "current" : ""}`} key={plan.id}>
      {plan.featured && <div className="popular-label">POPULAR</div>}
      <div className="plan-label">{plan.label}</div>{plan.priceHuf===0?<strong className="plan-price-new">Free</strong>:<><strong className="plan-price-new">{formatPrice(plan.introHuf,"HUF")} first month</strong><p className="plan-renewal">Then {formatPrice(plan.priceHuf,"HUF")} / month</p></>}
      <p>{plan.id === "FREE" ? "Get started for free." : plan.id === "PRO" ? "Find the middle ground." : "See the best prices first."}</p>
      {owner ? <button type="button" className="button-secondary" disabled>{plan.id === "PREMIUM" ? "Unlocked for Owner" : "Owner account"}</button> : plan.id === "FREE" ? <button type="button" className="button-secondary" disabled>{current === "FREE" ? "Current plan" : "Included plan"}</button> : <button type="button" className="button-primary" disabled={busy || !email.includes("@")} onClick={() => void subscribe(plan.id as "PRO" | "PREMIUM")}>{busy ? "Opening Stripe…" : `Subscribe to ${plan.label}`}</button>}
      <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
    </article>)}</div>
    <p className="small-note pricing-note">Deal access is checked by the server from your account subscription.</p>
  </main>;
}
