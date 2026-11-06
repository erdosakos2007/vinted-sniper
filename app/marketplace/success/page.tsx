"use client";
import { useEffect, useState } from "react";
export default function MarketplaceSuccessPage() {
  const [message, setMessage] = useState("Checking payment…");
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("session_id"); if (!id) { setMessage("Payment session ID not found."); return; } void fetch(`/api/marketplace/verify?session_id=${encodeURIComponent(id)}`).then(async (response) => { const data = await response.json() as { paid?: boolean; message?: string }; setMessage(data.paid ? "Payment successful. Your listing is now live in the Marketplace." : data.message || "Could not verify the payment."); }).catch(() => setMessage("Could not verify the payment.")); }, []);
  return <main className="page-wrap subpage-wrap"><section className="page-heading"><div className="eyebrow"><i/> MARKETPLACE · PAYMENT</div><h1>Payment <em>status.</em></h1><p>{message}</p></section><a className="button-secondary" href="/marketplace">Back to Marketplace ↗</a></main>;
}
