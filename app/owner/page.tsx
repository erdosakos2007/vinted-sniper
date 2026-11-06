"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Customer = {
  id: string;
  email: string | null;
  display_name: string;
  created_at: number;
  plan: string;
  status: string;
  current_period_end: number | null;
  source: string;
  auto_renew: number;
  marketing_opt_in: number;
  providers: string | null;
};
type OwnerData = { customers: Customer[]; optedInCount: number; newsletterConfigured: boolean };

export default function OwnerPage() {
  const [data, setData] = useState<OwnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { plan: string; days: string }>>({});
  const [busyEmail, setBusyEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/owner/customers", { cache: "no-store" });
      if (response.status === 403 || response.status === 401) { setBlocked(true); return; }
      const result = await response.json() as OwnerData & { message?: string };
      if (!response.ok) throw new Error(result.message || "Could not load the owner dashboard.");
      setBlocked(false);
      setData(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the owner dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.customers || []).filter((customer) => !term ||
      customer.email?.toLowerCase().includes(term) || customer.display_name.toLowerCase().includes(term));
  }, [data, query]);

  function draftFor(customer: Customer) {
    return drafts[customer.email || customer.id] || { plan: customer.plan, days: "30" };
  }

  async function updatePlan(customer: Customer) {
    if (!customer.email) return;
    const draft = draftFor(customer);
    setNotice("");
    setBusyEmail(customer.email);
    try {
      const response = await fetch("/api/owner/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customer.email, plan: draft.plan, days: Number(draft.days) }),
      });
      const result = await response.json() as { message?: string; success?: boolean };
      if (!response.ok) throw new Error(result.message || "Could not update the plan.");
      setNotice(`${customer.email}: plan updated to ${draft.plan}.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the plan.");
    } finally {
      setBusyEmail("");
    }
  }

  async function sendNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.optedInCount) return;
    const confirmed = window.confirm(`Send this email to ${data.optedInCount} customers who opted in?`);
    if (!confirmed) return;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/owner/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, campaignId: crypto.randomUUID() }),
      });
      const result = await response.json() as { message?: string; sentCount?: number; recipientCount?: number };
      if (!response.ok) throw new Error(result.message || "Could not send the newsletter.");
      setNotice(`Newsletter sent to ${result.sentCount} of ${result.recipientCount} opted-in customers.`);
      setSubject("");
      setMessage("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send the newsletter.");
    } finally {
      setSending(false);
    }
  }

  return <main className="page-wrap subpage-wrap owner-page">
    <section className="page-heading">
      <div className="eyebrow"><i /> PRIVATE · OWNER CONSOLE</div>
      <h1>Customer <em>desk.</em></h1>
      <p>Manage customer access and send updates to people who opted in.</p>
    </section>

    {loading ? <div className="empty-card">Checking owner access…</div> : blocked ? <div className="empty-card"><strong>Owner access required.</strong><span>Sign in with the owner account to open this private dashboard.</span><a href="/account">Go to account ↗</a></div> : <>
      {notice && <div className="notice-banner owner-notice" role="status"><span>ℹ</span><p>{notice}</p></div>}
      <section className="owner-stats">
        <article><small>CUSTOMER ACCOUNTS</small><strong>{data?.customers.length ?? 0}</strong></article>
        <article><small>EMAIL OPT-INS</small><strong>{data?.optedInCount ?? 0}</strong></article>
        <article><small>NEWSLETTER SERVICE</small><strong>{data?.newsletterConfigured ? "READY" : "SETUP NEEDED"}</strong></article>
      </section>

      <section className="owner-section">
        <div className="section-title"><div><div className="eyebrow"><i /> CUSTOMERS</div><h2>Accounts and plans</h2></div><button className="plain-button" onClick={() => void load()}>Refresh ↻</button></div>
        <label className="owner-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by customer name or email" /></label>
        <div className="owner-customer-list">
          {visibleCustomers.map((customer) => {
            const key = customer.email || customer.id;
            const draft = draftFor(customer);
            return <article className="owner-customer" key={customer.id}>
              <div className="owner-customer-main">
                <span className="owner-customer-avatar">{customer.display_name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{customer.display_name}</strong><small>{customer.email || "No email address"}</small><small>Joined {new Date(customer.created_at * 1000).toLocaleDateString()} · {customer.providers || "Email sign-in"}</small></div>
                <span className={`owner-plan-badge ${customer.plan.toLowerCase()}`}>{customer.plan}</span>
              </div>
              <div className="owner-plan-controls">
                <label>Plan<select value={draft.plan} onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, plan: event.target.value } }))}><option value="FREE">Free</option><option value="PRO">Plus / Pro</option><option value="PREMIUM">Premium</option></select></label>
                {draft.plan !== "FREE" && <label>Access days<input type="number" min="1" max="3650" value={draft.days} onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, days: event.target.value } }))} /></label>}
                <button className="button-secondary" disabled={!customer.email || busyEmail === customer.email} onClick={() => void updatePlan(customer)}>{busyEmail === customer.email ? "Saving…" : draft.plan === "FREE" ? "Set Free / revoke" : "Apply plan"}</button>
                <span className="owner-source-note">{customer.source === "owner" ? "Owner grant · no auto-renew" : customer.marketing_opt_in ? "Email updates: opted in" : "Email updates: not opted in"}</span>
              </div>
            </article>;
          })}
          {!visibleCustomers.length && <div className="empty-card">No matching customer accounts.</div>}
        </div>
      </section>

      <section className="owner-section owner-newsletter">
        <div className="section-title"><div><div className="eyebrow"><i /> CUSTOMER EMAIL</div><h2>Newsletter</h2></div></div>
        <p className="small-note">Only customers who explicitly opted in will receive this email. Every message includes an unsubscribe link.</p>
        {!data?.newsletterConfigured ? <div className="notice-banner"><span>ℹ</span><p>To enable sending, configure <strong>RESEND_API_KEY</strong> and <strong>EMAIL_FROM</strong> as private Cloudflare Pages secrets, and verify the sender domain in Resend.</p></div> : <form className="owner-newsletter-form" onSubmit={(event) => void sendNewsletter(event)}>
          <div className="owner-recipient-count">Recipients who opted in: <strong>{data.optedInCount}</strong></div>
          <label>Subject<input required minLength={3} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A short, clear subject" /></label>
          <label>Message<textarea required minLength={10} maxLength={5000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your update. It will be sent as plain text with an unsubscribe link." /></label>
          <button className="button-primary" type="submit" disabled={sending || !data.optedInCount}>{sending ? "Sending…" : `Send to ${data.optedInCount} opted-in customers →`}</button>
        </form>}
      </section>
    </>}
  </main>;
}
