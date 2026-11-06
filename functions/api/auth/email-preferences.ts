import { sessionFrom, type AuthEnv } from "./_shared";
type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown> };
type Env = AuthEnv & { DB?: { prepare(sql: string): Statement } };
type Context = { request: Request; env: Env };

export async function onRequestGet({ request, env }: Context) {
  const session = await sessionFrom(request, env);
  if (!session) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!env.DB) return Response.json({ message: "Database unavailable." }, { status: 503 });
  const row = await env.DB.prepare("SELECT marketing_opt_in, opted_in_at FROM email_marketing_preferences WHERE user_id = ?")
    .bind(session.userId).first<{ marketing_opt_in: number; opted_in_at: number | null }>();
  return Response.json({ marketingOptIn: row?.marketing_opt_in === 1, optedInAt: row?.opted_in_at ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function onRequestPost({ request, env }: Context) {
  const session = await sessionFrom(request, env);
  if (!session) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!env.DB) return Response.json({ message: "Database unavailable." }, { status: 503 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ message: "Request rejected." }, { status: 403 });
  if (!session.email) return Response.json({ message: "Add an email address to your account first." }, { status: 400 });

  let body: { marketingOptIn?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
  if (typeof body.marketingOptIn !== "boolean") return Response.json({ message: "Choose whether to receive product updates." }, { status: 400 });

  const optedIn = body.marketingOptIn;
  const existing = await env.DB.prepare("SELECT unsubscribe_token FROM email_marketing_preferences WHERE user_id = ?")
    .bind(session.userId).first<{ unsubscribe_token: string | null }>();
  const token = optedIn ? existing?.unsubscribe_token || crypto.randomUUID() : existing?.unsubscribe_token || null;
  await env.DB.prepare(`INSERT INTO email_marketing_preferences
      (user_id, marketing_opt_in, unsubscribe_token, opted_in_at, unsubscribed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      marketing_opt_in = excluded.marketing_opt_in,
      unsubscribe_token = COALESCE(email_marketing_preferences.unsubscribe_token, excluded.unsubscribe_token),
      opted_in_at = excluded.opted_in_at,
      unsubscribed_at = excluded.unsubscribed_at,
      updated_at = unixepoch()`)
    .bind(session.userId, optedIn ? 1 : 0, token, optedIn ? Math.floor(Date.now() / 1000) : null, optedIn ? null : Math.floor(Date.now() / 1000)).run();
  return Response.json({ success: true, marketingOptIn: optedIn });
}
