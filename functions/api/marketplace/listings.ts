type D1Statement = { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> };
type Env = { DB?: { prepare(sql: string): D1Statement } };
export async function onRequestGet({ env }: { env: Env }) {
  if (!env.DB) return Response.json({ message: "Marketplace database is unavailable." }, { status: 503 });
  const result = await env.DB.prepare("SELECT id, title, brand, price_huf, description, listing_url, image_url, expires_at, created_at FROM marketplace_ads WHERE status = 'ACTIVE' AND expires_at > unixepoch() ORDER BY created_at DESC LIMIT 200").all();
  return Response.json({ listings: result.results ?? [] }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
}
