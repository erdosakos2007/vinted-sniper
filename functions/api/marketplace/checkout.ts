type Statement = { bind(...values: unknown[]): Statement; run(): Promise<{ meta?: { changes?: number } }> };
type Env = { DB?: { prepare(sql: string): Statement }; STRIPE_SECRET_KEY?: string };
type Context = { request: Request; env: Env };
const fees: Record<number, number> = { 1: 200, 3: 300, 7: 700, 14: 1400, 30: 3000, 60: 6000 };
function validListingUrl(value: string) {
  try { const u = new URL(value); return u.protocol === "https:" && /(^|\.)vinted\.[a-z.]+$/i.test(u.hostname) && /^\/items\/\d+/.test(u.pathname); }
  catch { return false; }
}
export async function onRequestPost({ request, env }: Context) {
  try {
  if (!env.DB) return Response.json({ message: "The listings database is not connected." }, { status: 503 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ message: "Online payments are not connected yet. Add the Stripe secret key to enable paid listings." }, { status: 503 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Request rejected." }, { status: 403 });
  let data: Record<string, unknown>;
  try { data = await request.json() as Record<string, unknown>; } catch { return Response.json({ message: "Invalid form data." }, { status: 400 }); }
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 120) : "";
  const brand = typeof data.brand === "string" ? data.brand.trim().slice(0, 60) : "";
  const description = typeof data.description === "string" ? data.description.trim().slice(0, 1000) : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().slice(0, 254) : "";
  const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl.trim().slice(0, 500) : "";
  const price = Number(data.price);
  const duration = Number(data.duration);
  const fee = fees[duration];
  if (!title || !validListingUrl(url) || !Number.isInteger(price) || price < 1 || price > 100000000 || !fee || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Check the title, price, Vinted URL, email address, and listing duration." }, { status: 400 });
  let safeImage: string | null = null;
  try { const img = new URL(imageUrl); if (img.protocol === "https:" && /(^|\.)vinted\.(net|com)$/i.test(img.hostname)) safeImage = img.toString(); } catch { /* optional */ }
  const id = crypto.randomUUID();
  const base = new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set("mode", "payment"); form.set("success_url", `${base}/marketplace/success?session_id={CHECKOUT_SESSION_ID}`); form.set("cancel_url", `${base}/marketplace?cancelled=1`);
  form.set("customer_email", email); form.set("line_items[0][quantity]", "1"); form.set("line_items[0][price_data][currency]", "huf");
  // Stripe supports two-decimal HUF charges: 200 HUF is sent as 20000 minor units.
  form.set("line_items[0][price_data][unit_amount]", String(fee * 100));
  form.set("line_items[0][price_data][product_data][name]", `Vinted Sniper listing – ${duration} days`);
  form.set("metadata[ad_id]", id); form.set("metadata[duration_days]", String(duration));
  let stripeResponse: Response;
  try { stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form }); }
  catch { return Response.json({ message: "The Stripe checkout page is currently unavailable." }, { status: 502 }); }
  let session: { id?: string; url?: string; error?: { message?: string } };
  try { session = await stripeResponse.json() as typeof session; }
  catch { return Response.json({ message: `Stripe returned an unreadable response (HTTP ${stripeResponse.status}).` }, { status: 502 }); }
  if (!stripeResponse.ok || !session.id || !session.url) return Response.json({ message: session.error?.message || `Could not start checkout (Stripe HTTP ${stripeResponse.status}).` }, { status: 502 });
  const saved = await env.DB.prepare("INSERT INTO marketplace_ads (id, title, brand, price_huf, description, listing_url, image_url, email, duration_days, fee_huf, stripe_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, title, brand || null, price, description || null, url, safeImage, email, duration, fee, session.id).run();
  if (!saved.meta?.changes) return Response.json({ message: "Could not save the listing." }, { status: 500 });
  return Response.json({ checkoutUrl: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected checkout error.";
    return Response.json({ message: `Checkout error: ${message}` }, { status: 500 });
  }
}
