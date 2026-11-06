import { isOwnerEmail, sessionFrom, type AuthEnv } from "../auth/_shared";

type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null> };
type Env = AuthEnv & { DB?: { prepare(sql: string): Statement } };
type Context = { request: Request; env: Env };

export async function onRequestGet({ request, env }: Context) {
  const user = await sessionFrom(request, env);
  if (!user || !env.DB) return Response.json({ plan: "FREE", status: "INACTIVE" });
  if (isOwnerEmail(user.email, env)) return Response.json({ plan: "PREMIUM", status: "OWNER", autoRenew: false, owner: true });

  const userKey = user.email?.toLowerCase() || user.userId;
  const row = await env.DB.prepare(`SELECT plan, status, current_period_end, source, auto_renew
    FROM subscriptions WHERE lower(user_id) = lower(?)`).bind(userKey)
    .first<{ plan: string; status: string; current_period_end: number | null; source: string; auto_renew: number }>();
  const active = row?.status === "ACTIVE" && (!row.current_period_end || row.current_period_end > Date.now() / 1000);
  if (!row || !active) return Response.json({ plan: "FREE", status: "INACTIVE", autoRenew: false });
  return Response.json({
    plan: row.plan,
    status: row.status,
    current_period_end: row.current_period_end,
    source: row.source,
    autoRenew: row.auto_renew === 1,
  });
}
