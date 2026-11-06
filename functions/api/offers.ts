type D1Result<T = unknown> = { results?: T[]; meta?: { changes?: number } };
type D1Statement = { bind(...values: unknown[]): D1Statement; all<T = Record<string, unknown>>(): Promise<D1Result<T>>; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<D1Result> };
type D1Database = { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<D1Result[]> };
type Env = { DB?: D1Database };
type Context = { request: Request; env: Env };
import { isOwnerEmail, sessionFrom } from "./auth/_shared";

function validVintedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)vinted\.[a-z.]+$/i.test(url.hostname) && /^\/items\/\d+/.test(url.pathname);
  } catch { return false; }
}

async function hashIp(ip: string) {
  const bytes = new TextEncoder().encode(ip || "unknown");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }: Context) {
  if (!env.DB) return Response.json({ message: "D1 database is not bound." }, { status: 503 });
  const session = await sessionFrom(request, env);
  let plan: "FREE" | "PRO" | "PREMIUM" = "FREE";
  if(isOwnerEmail(session?.email,env))plan="PREMIUM";else if(session?.email){const sub=await env.DB.prepare("SELECT plan,status,current_period_end FROM subscriptions WHERE user_id=?").bind(session.email.toLowerCase()).first<{plan:string;status:string;current_period_end:number|null}>();if(sub?.status==="ACTIVE"&&(!sub.current_period_end||sub.current_period_end>Date.now()/1000)&&(sub.plan==="PRO"||sub.plan==="PREMIUM"))plan=sub.plan;}
  const rows = await env.DB.prepare("SELECT id, title, brand, price_minor, currency, listing_url, image_url, created_at FROM offers WHERE active = 1 ORDER BY created_at DESC LIMIT 500").all<Record<string, unknown>>();
  let offers=rows.results??[];
  if(plan==="FREE") offers=offers.sort((a,b)=>Number(b.price_minor)-Number(a.price_minor)).slice(0,2);
  else if(plan==="PRO"){offers=offers.sort((a,b)=>Number(a.price_minor)-Number(b.price_minor));const start=Math.max(0,Math.floor((offers.length-6)/2));offers=offers.slice(start,start+6)}
  else offers=offers.sort((a,b)=>Number(a.price_minor)-Number(b.price_minor));
  return Response.json({ offers, plan, updatedAt:new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function onRequestPost({ request, env }: Context) {
  if (!env.DB) return Response.json({ message: "D1 database is not bound." }, { status: 503 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Cross-site request rejected." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Invalid request body." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ message: "Invalid offer." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 120) : "";
  const brand = typeof data.brand === "string" ? data.brand.trim().slice(0, 60) : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const price = Number(data.price);
  const currency = data.currency === "EUR" ? "EUR" : "HUF";
  const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl.trim().slice(0, 500) : "";
  let safeImage: string | null = null;
  try { const image = new URL(imageUrl); if (image.protocol === "https:" && /(^|\.)vinted\.(net|com)$/i.test(image.hostname)) safeImage = image.toString(); } catch { /* Optional image is omitted if invalid. */ }
  if (!title || !validVintedUrl(url) || !Number.isFinite(price) || price <= 0 || price > 10_000_000) {
    return Response.json({ message: "Enter a title, a valid Vinted listing URL, and a positive price." }, { status: 400 });
  }

  const clientKey = await hashIp(request.headers.get("CF-Connecting-IP") || "unknown");
  const day = new Date().toISOString().slice(0, 10);
  const previous = await env.DB.prepare("SELECT count FROM offer_submissions WHERE client_key = ? AND day = ?").bind(clientKey, day).first<{ count: number }>();
  if ((previous?.count ?? 0) >= 20) return Response.json({ message: "You have reached today's submission limit." }, { status: 429 });

  const id = crypto.randomUUID();
  const result = await env.DB.prepare("INSERT OR IGNORE INTO offers (id, title, brand, price_minor, currency, listing_url, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, title, brand || null, Math.round(price * 100), currency, url, safeImage).run();
  if (!result.meta?.changes) return Response.json({ message: "This Vinted listing is already in the list." }, { status: 409 });
  await env.DB.prepare("INSERT INTO offer_submissions (client_key, day, count) VALUES (?, ?, 1) ON CONFLICT(client_key, day) DO UPDATE SET count = count + 1")
    .bind(clientKey, day).run();
  return Response.json({ added: true, id }, { status: 201 });
}
