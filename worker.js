const MAX_DEALS_PER_RUN = 2500;

function isVintedItemUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /(^|\.)vinted\.[a-z.]+$/i.test(url.hostname) &&
      /^\/items\/\d+(?:-|$|\/)/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function tierForPrice(price) {
  if (price < 3000) return "premium";
  if (price < 7000) return "plus";
  return "free";
}

const ALERT_AUDIENCES = [
  { tier: "free", deals: "DISCORD_WEBHOOK_FREE_DEALS", drops: "DISCORD_WEBHOOK_FREE_DROPS", maxTier: 0 },
  { tier: "pro", deals: "DISCORD_WEBHOOK_PRO_DEALS", drops: "DISCORD_WEBHOOK_PRO_DROPS", maxTier: 1 },
  { tier: "premium", deals: "DISCORD_WEBHOOK_PREMIUM_DEALS", drops: "DISCORD_WEBHOOK_PREMIUM_DROPS", maxTier: 2 },
];
const TIER_RANK = { free: 0, plus: 1, premium: 2 };
const ONLINE_WINDOW_SECONDS = 120;

async function sendOnlineCount(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing.");
  const now = Math.floor(Date.now() / 1000);
  if (now % 3600 < 60) {
    await env.DB.prepare("DELETE FROM site_presence WHERE last_seen < ?").bind(now - 7 * 86400).run();
  }
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM site_presence WHERE last_seen >= ?",
  ).bind(now - ONLINE_WINDOW_SECONDS).first();
  const count = Number(countRow?.count) || 0;
  const countryRows = await env.DB.prepare(`
    SELECT country_code, COUNT(*) AS count
    FROM site_presence
    WHERE last_seen >= ? AND country_code NOT IN ('XX', 'T1')
    GROUP BY country_code
    ORDER BY count DESC, country_code ASC
    LIMIT 5
  `).bind(now - ONLINE_WINDOW_SECONDS).all();
  const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
  const countries = (countryRows.results || []).map((row) => {
    const code = String(row.country_code || "XX").toUpperCase();
    const flag = [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");
    const name = countryNames.of(code) || code;
    return `${flag} ${name} (${Number(row.count) || 0})`;
  });
  const websiteUrl = "https://vinted-sniper-6xb.pages.dev";
  const embed = {
    author: { name: "Vinted Sniper · Website Status", icon_url: `${websiteUrl}/favicon.ico`, url: websiteUrl },
    title: "Vinted Sniper",
    url: websiteUrl,
    description: "Live website activity · updates automatically",
    color: 0x9fe83c,
    fields: [
      { name: "Status", value: "🟢 **Online**", inline: true },
      { name: "Active viewers", value: `**${count}**`, inline: true },
      { name: "Website", value: `[Open Vinted Sniper ↗](${websiteUrl})`, inline: false },
    ],
    image: { url: `${websiteUrl}/vinted-sniper-banner.png` },
    thumbnail: { url: `${websiteUrl}/favicon.ico` },
    footer: {
      text: countries.length
        ? `🌍 Viewers by country: ${countries.join(" · ")} · Updated every minute`
        : "🌍 Country totals appear while visitors are active · Updated every minute",
    },
    timestamp: new Date(now * 1000).toISOString(),
  };
  const payload = { content: "", embeds: [embed], allowed_mentions: { parse: [] } };

  // Without a configured webhook, still report the measurement in Worker logs.
  if (!env.DISCORD_WEBHOOK_ONLINE) {
    console.log(`Currently online: ${count} (set DISCORD_WEBHOOK_ONLINE to publish to Discord).`);
    return;
  }

  const prior = await env.DB.prepare(
    "SELECT message_id FROM discord_presence_message WHERE id = 1",
  ).first();
  if (prior?.message_id) {
    const editUrl = new URL(env.DISCORD_WEBHOOK_ONLINE);
    editUrl.pathname = `${editUrl.pathname.replace(/\/$/, "")}/messages/${encodeURIComponent(prior.message_id)}`;
    editUrl.search = "";
    const edited = await fetch(editUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (edited.ok) {
      await env.DB.prepare("UPDATE discord_presence_message SET updated_at = ? WHERE id = 1").bind(now).run();
      console.log(`Updated Discord online count: ${count}.`);
      return;
    }
    if (edited.status !== 404) throw new Error(`Discord online webhook edit failed (HTTP ${edited.status}).`);
  }

  const createUrl = new URL(env.DISCORD_WEBHOOK_ONLINE);
  createUrl.searchParams.set("wait", "true");
  const created = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Vinted Sniper", ...payload }),
  });
  if (!created.ok) throw new Error(`Discord online webhook post failed (HTTP ${created.status}).`);
  const message = await created.json();
  if (!message?.id) throw new Error("Discord did not return an online status message ID.");
  await env.DB.prepare(`
    INSERT INTO discord_presence_message (id, message_id, updated_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET message_id = excluded.message_id, updated_at = excluded.updated_at
  `).bind(String(message.id), now).run();
  console.log(`Posted Discord online count: ${count}.`);
}

async function sendDiscordDigest(webhook, title, items, color) {
  if (!webhook || !items.length) return;
  // Discord accepts up to 10 embeds per webhook request; cap alerts per run to avoid spam.
  const embeds = items.slice(0, 10).map(({ deal, oldPrice }) => {
    const safeTitle = deal.title.replace(/[\[\]()<>]/g, "").slice(0, 240);
    const description = oldPrice == null
      ? `${deal.price} ${deal.currency}${deal.brand ? ` · ${deal.brand}` : ""}${deal.size ? ` · size ${deal.size}` : ""}`
      : `~~${oldPrice} ${deal.currency}~~ → **${deal.price} ${deal.currency}**`;
    return {
      title: safeTitle,
      url: deal.url,
      description,
      color,
      ...(deal.imageUrl ? { thumbnail: { url: deal.imageUrl } } : {}),
    };
  });
  const extra = items.length > embeds.length ? ` (+${items.length - embeds.length} more)` : "";
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Vinted Sniper", content: `${title}${extra}`, embeds, allowed_mentions: { parse: [] } }),
  });
  if (!response.ok) console.warn(`Discord ${title} webhook returned HTTP ${response.status}.`);
}

async function notifyDiscord(env, newDeals, drops) {
  for (const audience of ALERT_AUDIENCES) {
    const visible = (deal) => TIER_RANK[deal.tier] <= audience.maxTier;
    const audienceNew = newDeals.filter(visible);
    const audienceDrops = drops.filter(({ deal }) => visible(deal));
    try {
      await Promise.all([
        sendDiscordDigest(env[audience.deals], `🆕 ${audience.tier.toUpperCase()} new listings`, audienceNew, 0x9fe83c),
        sendDiscordDigest(env[audience.drops], `🔻 ${audience.tier.toUpperCase()} price drops`, audienceDrops, 0x38bdf8),
      ]);
    } catch (error) {
      console.warn(`Discord ${audience.tier} notification failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;

  const id = firstString(item.id == null ? "" : String(item.id), item.item_id == null ? "" : String(item.item_id));
  const rawPrice = item.price && typeof item.price === "object" ? item.price.amount : item.price;
  const price = Number(rawPrice);
  const title = firstString(item.title, item.name).slice(0, 200);
  const rawUrl = firstString(item.url, item.link, item.item_url);
  let url = "";
  try {
    url = rawUrl
      ? new URL(rawUrl, "https://www.vinted.com").toString()
      : /^\d+$/.test(id)
        ? `https://www.vinted.com/items/${id}`
        : "";
  } catch {
    return null;
  }

  if (!id || !title || !Number.isFinite(price) || price <= 0 || !isVintedItemUrl(url)) return null;

  const rawCurrency = firstString(
    item.price && typeof item.price === "object" ? item.price.currency_code : "",
    item.currency,
  ).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "HUF";
  const rawPhoto = item.photo && typeof item.photo === "object" ? item.photo.url : item.photo;
  const firstPhoto = Array.isArray(item.photos) ? item.photos[0] : null;
  const rawImage = firstString(item.image_url, item.imageUrl, typeof rawPhoto === "string" ? rawPhoto : "", firstPhoto?.url);
  let imageUrl = null;
  try {
    const parsedImage = new URL(rawImage);
    if (parsedImage.protocol === "https:") imageUrl = parsedImage.toString().slice(0, 1000);
  } catch {
    // Images are optional; omit invalid values.
  }

  return {
    id: id.slice(0, 120),
    title,
    price,
    currency,
    brand: firstString(item.brand_title, item.brand).slice(0, 80) || null,
    size: firstString(item.size_title, item.size).slice(0, 40) || null,
    url,
    imageUrl,
    tier: tierForPrice(price),
  };
}

function extractItems(payload) {
  const candidates = [
    payload?.items,
    payload?.deals,
    payload?.data?.items,
    payload?.data?.deals,
    payload?.data,
    payload,
  ];
  return candidates.find(Array.isArray) || [];
}

async function fetchAuthorizedFeed(env, sourceUrl) {
  const headers = { Accept: "application/json" };
  if (env.DEALS_SOURCE_TOKEN) headers.Authorization = `Bearer ${env.DEALS_SOURCE_TOKEN}`;
  const response = await fetch(sourceUrl, {
    headers,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Deal feed returned HTTP ${response.status}.`);
  return extractItems(await response.json()).map(normalizeItem).filter(Boolean);
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([
      syncDeals(env).catch((error) => {
        console.error(`Deal sync stopped: ${error instanceof Error ? error.message : "unknown error"}`);
      }),
      sendOnlineCount(env).catch((error) => {
        console.error(`Online count update failed: ${error instanceof Error ? error.message : "unknown error"}`);
      }),
    ]));
  },
};

async function syncDeals(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing.");
  if (!env.DEALS_SOURCE_URL) {
    console.log("No deal source configured; skipped this scheduled run.");
    return;
  }

  let source;
  try {
    const configuredUrl = env.DEALS_SOURCE_URL.trim();
    source = new URL(/^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`);
  } catch {
    console.error("Invalid DEALS_SOURCE_URL. Set it to the HTTPS JSON feed provided by your separately hosted backend.");
    return;
  }
  if (source.protocol !== "https:") throw new Error("DEALS_SOURCE_URL must use HTTPS.");
  const sourceUrl = source.toString();

  if (!env.DEALS_SOURCE_TOKEN) {
    console.log("Deal sync is paused until the separately hosted, authorized JSON feed is configured.");
    return;
  }

  const deals = await fetchAuthorizedFeed(env, sourceUrl);

  const unique = new Map();
  for (const deal of deals) {
    if (!unique.has(deal.id)) unique.set(deal.id, deal);
    if (unique.size >= MAX_DEALS_PER_RUN) break;
  }

  const normalizedDeals = [...unique.values()];
  const priorRows = normalizedDeals.length
    ? await env.DB.prepare(`SELECT id, price, currency FROM deals WHERE id IN (${normalizedDeals.map(() => "?").join(",")})`)
        .bind(...normalizedDeals.map((deal) => deal.id)).all()
    : { results: [] };
  const priorById = new Map((priorRows.results || []).map((row) => [String(row.id), row]));
  const newDeals = [];
  const drops = [];
  const savedRows = normalizedDeals.length
    ? await env.DB.prepare(`SELECT user_id, deal_id, title, price, currency, url FROM saved_deals WHERE deal_id IN (${normalizedDeals.map(() => "?").join(",")})`)
        .bind(...normalizedDeals.map((deal) => deal.id)).all()
    : { results: [] };
  const dealById = new Map(normalizedDeals.map((deal) => [deal.id, deal]));
  const alertWrites = [];
  for (const saved of savedRows.results || []) {
    const deal = dealById.get(String(saved.deal_id));
    if (!deal) continue;
    const savedPrice = Number(saved.price);
    const sameCurrency = String(saved.currency || deal.currency) === deal.currency;
    if (sameCurrency && deal.price < savedPrice) {
      alertWrites.push(env.DB.prepare(`INSERT INTO price_drop_alerts(id,user_id,deal_id,title,previous_price,current_price,currency,url)
        VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), saved.user_id, deal.id, deal.title, savedPrice, deal.price, deal.currency, deal.url));
    }
    alertWrites.push(env.DB.prepare(`UPDATE saved_deals SET title=?,brand=?,price=?,currency=?,url=?,image_url=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND deal_id=?`)
      .bind(deal.title, deal.brand, deal.price, deal.currency, deal.url, deal.imageUrl, saved.user_id, deal.id));
  }
  for (const deal of normalizedDeals) {
    const prior = priorById.get(deal.id);
    if (!prior) newDeals.push(deal);
    else if (String(prior.currency || deal.currency) === deal.currency && Number(prior.price) > deal.price) {
      drops.push({ deal, oldPrice: Number(prior.price) });
    }
  }

  const statements = normalizedDeals.map((deal) => env.DB.prepare(`
    INSERT INTO deals (id, title, price, currency, brand, size, url, image_url, tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, price=excluded.price, currency=excluded.currency,
      brand=excluded.brand, size=excluded.size, url=excluded.url,
      image_url=excluded.image_url, tier=excluded.tier
  `).bind(deal.id, deal.title, deal.price, deal.currency, deal.brand, deal.size, deal.url, deal.imageUrl, deal.tier));

  if (statements.length || alertWrites.length) await env.DB.batch([...statements, ...alertWrites]);
  await notifyDiscord(env, newDeals, drops);
  console.log(`Deal sync complete; saved ${statements.length} unique listings from the configured JSON feed.`);
}
