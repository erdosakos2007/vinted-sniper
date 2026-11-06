type Statement = { bind(...values: unknown[]): Statement; run(): Promise<unknown>; first<T = Record<string, unknown>>(): Promise<T | null> };
type Env = { DB?: { prepare(sql: string): Statement } };
type Context = { request: Request; env: Env };

function html(message: string, showForm: boolean, token: string) {
  const action = showForm ? `<form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form>` : "";
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · Vinted Sniper</title><body style="margin:0;background:#0b0e0b;color:#eef2ea;font:16px Arial,sans-serif"><main style="max-width:560px;margin:12vh auto;padding:32px;border:1px solid #30392e;border-radius:14px;background:#121712"><h1 style="color:#b5f044">Vinted Sniper</h1><p>${message}</p>${action}</main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function unsubscribe(env: Env, token: string) {
  if (!env.DB || !/^[a-f0-9-]{36}$/i.test(token)) return false;
  const row = await env.DB.prepare("SELECT user_id FROM email_marketing_preferences WHERE unsubscribe_token = ?")
    .bind(token).first<{ user_id: string }>();
  if (!row) return false;
  await env.DB.prepare("UPDATE email_marketing_preferences SET marketing_opt_in = 0, unsubscribed_at = unixepoch(), updated_at = unixepoch() WHERE user_id = ?")
    .bind(row.user_id).run();
  return true;
}

export async function onRequestGet({ request, env }: Context) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!env.DB || !/^[a-f0-9-]{36}$/i.test(token)) return html("This unsubscribe link is invalid or expired.", false, "");
  const row = await env.DB.prepare("SELECT user_id FROM email_marketing_preferences WHERE unsubscribe_token = ? AND marketing_opt_in = 1")
    .bind(token).first<{ user_id: string }>();
  return row
    ? html("You are currently subscribed to product updates. Click below to unsubscribe.", true, token)
    : html("This email address is already unsubscribed.", false, "");
}

export async function onRequestPost({ request, env }: Context) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (!token) {
    try { token = String((await request.formData()).get("token") || ""); } catch { /* One-click requests carry the token in the URL. */ }
  }
  const done = await unsubscribe(env, token);
  return html(done ? "You have been unsubscribed from product updates." : "This unsubscribe link is invalid or expired.", false, "");
}
