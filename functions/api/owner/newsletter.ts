import { isOwnerEmail, sessionFrom, type AuthEnv } from "../auth/_shared";

type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>; run(): Promise<unknown> };
type Env = AuthEnv & { DB?: { prepare(sql: string): Statement }; RESEND_API_KEY?: string; EMAIL_FROM?: string };
type Context = { request: Request; env: Env };
type Recipient = { email: string; unsubscribe_token: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function onRequestPost({ request, env }: Context) {
  const session = await sessionFrom(request, env);
  if (!session?.email || !isOwnerEmail(session.email, env)) return Response.json({ message: "Owner access required." }, { status: 403 });
  if (!env.DB || !env.RESEND_API_KEY || !env.EMAIL_FROM) return Response.json({ message: "Newsletter email service is not configured yet." }, { status: 503 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ message: "Request rejected." }, { status: 403 });

  let body: { subject?: unknown; message?: unknown; campaignId?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 120) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";
  const campaignId = typeof body.campaignId === "string" && /^[a-f0-9-]{36}$/i.test(body.campaignId) ? body.campaignId : "";
  if (subject.length < 3 || message.length < 10 || !campaignId) return Response.json({ message: "Add a subject and message, then try again." }, { status: 400 });

  try {
    const alreadyUsed = await env.DB.prepare("SELECT id FROM owner_email_campaigns WHERE id = ?").bind(campaignId).first();
    if (alreadyUsed) return Response.json({ message: "This campaign was already submitted." }, { status: 409 });
    const audience = await env.DB.prepare(`SELECT u.email, p.unsubscribe_token
      FROM email_marketing_preferences p JOIN users u ON u.id = p.user_id
      WHERE p.marketing_opt_in = 1 AND u.email IS NOT NULL AND p.unsubscribe_token IS NOT NULL
      ORDER BY p.opted_in_at ASC LIMIT 1000`).all<Recipient>();
    const recipients = audience.results || [];
    if (!recipients.length) return Response.json({ message: "There are no customers who opted in to product emails." }, { status: 400 });

    const origin = new URL(request.url).origin;
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");
    await env.DB.prepare(`INSERT INTO owner_email_campaigns
      (id, actor_email, subject, body, recipient_count, status) VALUES (?, ?, ?, ?, ?, 'SENDING')`)
      .bind(campaignId, session.email.toLowerCase(), subject, message, recipients.length).run();

    let sentCount = 0;
    for (let offset = 0; offset < recipients.length; offset += 100) {
      const batch = recipients.slice(offset, offset + 100).map((recipient) => {
        const unsubscribeUrl = `${origin}/api/marketing/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
        return {
          from: env.EMAIL_FROM,
          to: [recipient.email],
          subject,
          html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#20251f"><h2>${safeSubject}</h2><p style="line-height:1.7">${safeMessage}</p><hr><p style="font-size:12px;color:#687064">You are receiving this email because you opted in to Vinted Sniper product updates. <a href="${unsubscribeUrl}">Unsubscribe</a></p></div>`,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      });
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `vinted-sniper-${campaignId}-${offset}`,
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        await env.DB.prepare("UPDATE owner_email_campaigns SET sent_count = ?, status = ? WHERE id = ?")
          .bind(sentCount, sentCount ? "PARTIAL_FAILED" : "FAILED", campaignId).run();
        return Response.json({ message: `Email service rejected the send request (HTTP ${response.status}).`, sentCount, recipientCount: recipients.length }, { status: 502 });
      }
      sentCount += batch.length;
      await env.DB.prepare("UPDATE owner_email_campaigns SET sent_count = ? WHERE id = ?").bind(sentCount, campaignId).run();
    }

    await env.DB.prepare("UPDATE owner_email_campaigns SET status = 'SENT' WHERE id = ?").bind(campaignId).run();
    await env.DB.prepare(`INSERT INTO owner_audit_log (id, actor_email, target_email, action, details)
      VALUES (?, ?, '*opted-in subscribers*', 'send_newsletter', ?)`)
      .bind(crypto.randomUUID(), session.email.toLowerCase(), JSON.stringify({ campaignId, recipientCount: recipients.length, subject })).run();
    return Response.json({ success: true, sentCount, recipientCount: recipients.length });
  } catch {
    return Response.json({ message: "Could not send the newsletter. Check the email provider settings." }, { status: 502 });
  }
}
