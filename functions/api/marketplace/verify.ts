type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown> };
type Env = { DB?: { prepare(sql: string): Statement }; STRIPE_SECRET_KEY?: string };
type Context = { request: Request; env: Env };
export async function onRequestGet({ request, env }: Context) {
  if (!env.DB || !env.STRIPE_SECRET_KEY) return Response.json({ message: "Payment verification is not configured yet." }, { status: 503 });
  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) return Response.json({ message: "Invalid payment session ID." }, { status: 400 });
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  const session = await response.json() as { payment_status?: string; metadata?: { ad_id?: string }; id?: string };
  if (!response.ok || session.id !== sessionId || session.payment_status !== "paid" || !session.metadata?.ad_id) return Response.json({ paid: false, message: "Payment could not be verified yet." }, { status: 402 });
  const ad = await env.DB.prepare("SELECT duration_days FROM marketplace_ads WHERE id = ? AND stripe_session_id = ?").bind(session.metadata.ad_id, sessionId).first<{ duration_days: number }>();
  if (!ad) return Response.json({ paid: false, message: "Listing not found." }, { status: 404 });
  await env.DB.prepare("UPDATE marketplace_ads SET status = 'ACTIVE', expires_at = unixepoch() + (? * 86400) WHERE id = ? AND stripe_session_id = ?").bind(ad.duration_days, session.metadata.ad_id, sessionId).run();
  return Response.json({ paid: true });
}
