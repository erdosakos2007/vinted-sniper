import { sessionFrom, type AuthEnv } from "./auth/_shared";

type Statement = {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
};
type Context = { request: Request; env: AuthEnv };

function validListing(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /(^|\.)vinted\.[a-z.]+$/i.test(parsed.hostname) && /^\/items\/\d+/.test(parsed.pathname);
  } catch { return false; }
}

export async function onRequestGet({ request, env }: Context) {
  const user = await sessionFrom(request, env);
  if (!user || !env.DB) return Response.json({ message: "Sign in to save listings and see price alerts." }, { status: 401 });
  const [saved, alerts] = await Promise.all([
    env.DB.prepare("SELECT deal_id AS id,title,brand,price,currency,url,image_url,created_at FROM saved_deals WHERE user_id=? ORDER BY updated_at DESC").bind(user.userId).all(),
    env.DB.prepare("SELECT id,deal_id AS dealId,title,previous_price AS previousPrice,current_price AS currentPrice,currency,url,detected_at AS detectedAt,seen FROM price_drop_alerts WHERE user_id=? ORDER BY detected_at DESC LIMIT 100").bind(user.userId).all(),
  ]);
  return Response.json({ saved: saved.results ?? [], alerts: alerts.results ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function onRequestPost({ request, env }: Context) {
  const user = await sessionFrom(request, env);
  if (!user || !env.DB) return Response.json({ message: "Sign in to save listings." }, { status: 401 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Request rejected." }, { status: 403 });
  let data: Record<string, unknown>;
  try { data = await request.json() as Record<string, unknown>; } catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
  const id = typeof data.id === "string" ? data.id.slice(0, 120) : "";
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 200) : "";
  const brand = typeof data.brand === "string" ? data.brand.trim().slice(0, 80) : "";
  const price = Number(data.price);
  const currency = data.currency === "EUR" ? "EUR" : "HUF";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const imageUrl = typeof data.imageUrl === "string" && /^https:\/\//i.test(data.imageUrl) ? data.imageUrl.slice(0, 1000) : null;
  if (!id || !title || !Number.isFinite(price) || price <= 0 || !validListing(url)) return Response.json({ message: "This does not look like a valid Vinted listing." }, { status: 400 });
  await env.DB.prepare(`INSERT INTO saved_deals(user_id,deal_id,title,brand,price,currency,url,image_url)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,deal_id) DO UPDATE SET title=excluded.title,brand=excluded.brand,price=excluded.price,currency=excluded.currency,url=excluded.url,image_url=excluded.image_url,updated_at=CURRENT_TIMESTAMP`)
    .bind(user.userId, id, title, brand || null, price, currency, url, imageUrl).run();
  return Response.json({ saved: true }, { status: 201 });
}

export async function onRequestDelete({ request, env }: Context) {
  const user = await sessionFrom(request, env);
  if (!user || !env.DB) return Response.json({ message: "Sign in to remove saved listings." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return Response.json({ message: "Missing listing ID." }, { status: 400 });
  await env.DB.prepare("DELETE FROM saved_deals WHERE user_id=? AND deal_id=?").bind(user.userId, id).run();
  return Response.json({ saved: false });
}
