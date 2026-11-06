type Statement = { bind(...values: unknown[]): Statement; run(): Promise<unknown> };
type Env = { DB?: { prepare(sql: string): Statement }; STRIPE_SECRET_KEY?: string };
type Context = { request: Request; env: Env };
export async function onRequestGet({ request, env }: Context) {
  if (!env.DB || !env.STRIPE_SECRET_KEY) return Response.json({ message: "Subscription verification is not configured." }, { status: 503 });
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(id)) return Response.json({ message: "Invalid checkout session." }, { status: 400 });
  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    const session = await response.json() as { id?: string; mode?: string; status?: string; payment_status?: string; customer?: string; metadata?: { plan?: string; email?: string }; subscription?: string };
    const plan = session.metadata?.plan;
    const email = session.metadata?.email;
    if (!response.ok || session.id !== id || session.mode !== "subscription" || session.status !== "complete" || session.payment_status !== "paid" || (plan !== "PRO" && plan !== "PREMIUM") || !email) return Response.json({ active: false, message: "Payment is not complete yet." }, { status: 402 });
    if(!session.subscription)return Response.json({active:false,message:"Stripe did not return the subscription."},{status:502});
    const subRes=await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(session.subscription)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
    const sub=await subRes.json() as {status?:string;current_period_end?:number;cancel_at_period_end?:boolean;customer?:string};
    if(!subRes.ok||!sub.current_period_end)return Response.json({active:false,message:"Could not load subscription period."},{status:502});
    await env.DB.prepare("INSERT INTO subscriptions (user_id, plan, status, provider_customer_id, current_period_end, source, auto_renew) VALUES (?, ?, ?, ?, ?, 'stripe', ?) ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, status = excluded.status, provider_customer_id = excluded.provider_customer_id, current_period_end = excluded.current_period_end, source = 'stripe', auto_renew = excluded.auto_renew, updated_at = unixepoch()")
      .bind(email.toLowerCase(), plan, sub.status === "active" ? "ACTIVE" : "INACTIVE", sub.customer || session.customer || null, sub.current_period_end, sub.cancel_at_period_end ? 0 : 1).run();
    return Response.json({ active: sub.status === "active", plan, currentPeriodEnd: sub.current_period_end, autoRenew: !sub.cancel_at_period_end, status: sub.status });
  } catch { return Response.json({ message: "Could not verify the subscription." }, { status: 502 }); }
}
