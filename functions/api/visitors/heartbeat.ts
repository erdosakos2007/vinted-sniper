type Stmt = { bind(...values: unknown[]): Stmt; run(): Promise<unknown> };
type Env = { DB?: { prepare(sql: string): Stmt } };
type Context = { request: Request; env: Env };
type CloudflareRequest = Request & { cf?: { country?: string } };

export async function onRequestPost({ request, env }: Context) {
  if (!env.DB) return Response.json({ error: "Database is not configured." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const visitorId = body && typeof body === "object"
    ? (body as { visitorId?: unknown }).visitorId
    : null;
  if (typeof visitorId !== "string" || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
    return Response.json({ error: "Invalid visitor ID." }, { status: 400 });
  }
  const rawCountry = (request as CloudflareRequest).cf?.country?.toUpperCase() || "XX";
  const countryCode = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : "XX";

  try {
    await env.DB.prepare(`
      INSERT INTO site_presence (visitor_id, last_seen, country_code) VALUES (?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen = excluded.last_seen,
        country_code = excluded.country_code
    `).bind(visitorId, Math.floor(Date.now() / 1000), countryCode).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not record presence." }, { status: 500 });
  }
}
