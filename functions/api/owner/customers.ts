import { isOwnerEmail, sessionFrom, type AuthEnv } from "../auth/_shared";

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};
type Env = AuthEnv & { DB?: { prepare(sql: string): Statement } };
type Context = { request: Request; env: Env };

async function owner({ request, env }: Context) {
  const session = await sessionFrom(request, env);
  if (!session?.email || !isOwnerEmail(session.email, env)) return null;
  return session;
}

export async function onRequestGet(context: Context) {
  const session = await owner(context);
  const { env } = context;
  if (!session) return Response.json({ message: "Owner access required." }, { status: 403 });
  if (!env.DB) return Response.json({ message: "Database unavailable." }, { status: 503 });

  try {
    const [customers, audience] = await Promise.all([
      env.DB.prepare(`
        SELECT u.id, u.email, u.display_name, u.avatar_url, u.created_at,
          COALESCE(s.plan, 'FREE') AS plan,
          COALESCE(s.status, 'INACTIVE') AS status,
          s.current_period_end,
          COALESCE(s.source, 'none') AS source,
          COALESCE(s.auto_renew, 0) AS auto_renew,
          COALESCE(p.marketing_opt_in, 0) AS marketing_opt_in,
          (SELECT GROUP_CONCAT(provider, ',') FROM oauth_identities oi WHERE oi.user_id = u.id) AS providers
        FROM users u
        LEFT JOIN subscriptions s ON lower(s.user_id) = lower(COALESCE(u.email, u.id))
        LEFT JOIN email_marketing_preferences p ON p.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 500
      `).all(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM email_marketing_preferences
        WHERE marketing_opt_in = 1`).first<{ count: number }>(),
    ]);
    return Response.json({
      customers: customers.results || [],
      optedInCount: Number(audience?.count) || 0,
      newsletterConfigured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "Could not load customer accounts." }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }: Context) {
  const session = await owner({ request, env });
  if (!session?.email) return Response.json({ message: "Owner access required." }, { status: 403 });
  if (!env.DB) return Response.json({ message: "Database unavailable." }, { status: 503 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return Response.json({ message: "Request rejected." }, { status: 403 });
  }

  let body: { email?: unknown; plan?: unknown; days?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const plan = body.plan === "PRO" || body.plan === "PREMIUM" ? body.plan : body.plan === "FREE" ? "FREE" : null;
  const days = Number(body.days);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !plan || (plan !== "FREE" && (!Number.isInteger(days) || days < 1 || days > 3650))) {
    return Response.json({ message: "Choose an existing account, a plan, and a valid access duration." }, { status: 400 });
  }

  try {
    const customer = await env.DB.prepare("SELECT id FROM users WHERE lower(email) = ?").bind(email).first<{ id: string }>();
    if (!customer) return Response.json({ message: "No customer account uses that email." }, { status: 404 });

    const previous = await env.DB.prepare(`SELECT plan, status, current_period_end, source FROM subscriptions
      WHERE lower(user_id) = ?`).bind(email).first<{ plan: string; status: string; current_period_end: number | null; source: string }>();
    const now = Math.floor(Date.now() / 1000);
    const currentIsPaidAndActive = previous?.source === "stripe" && previous.status === "ACTIVE"
      && (!previous.current_period_end || previous.current_period_end > now);
    if (currentIsPaidAndActive) {
      return Response.json({ message: "This customer already has an active Stripe subscription. Change it in Stripe first." }, { status: 409 });
    }

    const until = plan === "FREE" ? null : now + days * 86400;
    const status = plan === "FREE" ? "INACTIVE" : "ACTIVE";
    await env.DB.prepare(`INSERT INTO subscriptions
      (user_id, plan, status, provider_customer_id, current_period_end, source, auto_renew)
      VALUES (?, ?, ?, NULL, ?, 'owner', 0)
      ON CONFLICT(user_id) DO UPDATE SET
        plan = excluded.plan,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        source = 'owner',
        auto_renew = 0,
        updated_at = unixepoch()`)
      .bind(email, plan, status, until).run();

    await env.DB.prepare(`INSERT INTO owner_audit_log (id, actor_email, target_email, action, details)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), session.email.toLowerCase(), email, plan === "FREE" ? "revoke_plan" : "grant_plan", JSON.stringify({ plan, days: plan === "FREE" ? 0 : days })).run();

    return Response.json({ success: true, email, plan, currentPeriodEnd: until });
  } catch {
    return Response.json({ message: "Could not update this customer's plan." }, { status: 500 });
  }
}
