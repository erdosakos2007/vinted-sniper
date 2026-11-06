export type VintedDeal = {
  id: string;
  title: string;
  brand: string;
  price: number;
  currency: "HUF" | "EUR";
  url: string;
  imageUrl: string;
  createdAt: number;
};

export type Plan = "FREE" | "PRO" | "PREMIUM";
export type LockedCounts = { plus: number; premium: number };

const DEALS_KEY = "dowex-vinted-deals-v1";
const PLAN_KEY = "dowex-vinted-plan-preview-v1";

export function getDeals(): VintedDeal[] {
  try {
    const raw = localStorage.getItem(DEALS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is VintedDeal => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.price === "number" && typeof item.url === "string")) : [];
  } catch { return []; }
}

export function saveDeals(deals: VintedDeal[]) {
  localStorage.setItem(DEALS_KEY, JSON.stringify(deals));
}

export async function loadDealsFeed(): Promise<{ deals: VintedDeal[]; plan: Plan; lockedCounts: LockedCounts }> {
  try {
    const response = await fetch("/api/deals", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    let source = data?.deals;
    const plan: Plan = data?.plan === "PRO" || data?.plan === "PREMIUM" ? data.plan : "FREE";
    const rawCounts = data?.lockedCounts;
    const lockedCounts: LockedCounts = { plus: Number(rawCounts?.plus) || 0, premium: Number(rawCounts?.premium) || 0 };
    if (response.ok && (!Array.isArray(source) || source.length === 0)) {
      const fallbackResponse = await fetch("/api/offers", { cache: "no-store" });
      const fallback = await fallbackResponse.json().catch(() => null);
      if (fallbackResponse.ok && Array.isArray(fallback?.offers)) source = fallback.offers;
    }
    if (response.ok && Array.isArray(source)) {
      localStorage.setItem(PLAN_KEY, plan);
      const offers: VintedDeal[] = source.map((item: Record<string, unknown>) => ({
        id: String(item.id), title: String(item.title), brand: String(item.brand || ""),
        price: item.price_minor!==undefined?Number(item.price_minor)/100:Number(item.price), currency: item.currency === "EUR" ? "EUR" : "HUF",
        url: String(item.listing_url||item.url), imageUrl: String(item.image_url||item.imageUrl || ""), createdAt: typeof item.created_at==="number"?Number(item.created_at)*1000:Date.parse(String(item.created_at||""))||0,
      }));
      saveDeals(offers);
      return { deals: offers, plan, lockedCounts };
    }
  } catch { /* Local development can use the browser cache before Pages Functions are running. */ }
  return { deals: getDeals(), plan: getPlan(), lockedCounts: { plus: 0, premium: 0 } };
}

export async function loadDeals(): Promise<VintedDeal[]> {
  return (await loadDealsFeed()).deals;
}

export async function submitDeal(deal: VintedDeal): Promise<void> {
  try {
    const response = await fetch("/api/offers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: deal.title, brand: deal.brand, price: deal.price, currency: deal.currency, url: deal.url, imageUrl: deal.imageUrl }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) return;
    if (response.status !== 404 && response.status !== 503) throw new Error(data?.message || "Could not save the listing.");
  } catch (error) {
    if (error instanceof Error && error.message !== "Failed to fetch") throw error;
  }
  const current = getDeals();
  if (current.some((item) => item.url === deal.url)) throw new Error("This listing is already saved on this device.");
  saveDeals([deal, ...current]);
}

export function getPlan(): Plan {
  try {
    const plan = localStorage.getItem(PLAN_KEY);
    return plan === "PRO" || plan === "PREMIUM" ? plan : "FREE";
  } catch { return "FREE"; }
}

export function setPlanPreview(plan: Plan) {
  localStorage.setItem(PLAN_KEY, plan);
}

export function visibleDeals(deals: VintedDeal[], plan: Plan) {
  const cheapest = [...deals].sort((a, b) => a.price - b.price);
  if (plan === "FREE") return cheapest.slice(-2).reverse();
  if (plan === "PRO") {
    const start = Math.max(0, Math.floor((cheapest.length - 6) / 2));
    return cheapest.slice(start, start + 6);
  }
  return cheapest;
}

export function formatPrice(price: number, currency: VintedDeal["currency"] = "HUF") {
  let target:string=currency,amount=price,locale="en-GB";
  try{target=localStorage.getItem("vs-currency")||currency;locale=({hu:"hu-HU",de:"de-DE",fr:"fr-FR",es:"es-ES",it:"it-IT",pl:"pl-PL",ro:"ro-RO",en:"en-GB"} as Record<string,string>)[localStorage.getItem("vs-language")||"en"]||"en-GB";const raw=localStorage.getItem("vs-rates");if(raw){const rates=JSON.parse(raw) as Record<string,number>;const inHuf=currency==="EUR"?price/(rates.EUR||1):price;amount=target==="HUF"?inHuf:inHuf*(rates[target]||1);}}catch{}
  return new Intl.NumberFormat(locale, { style: "currency", currency:target, currencyDisplay: "code", maximumFractionDigits: target==="HUF"?0:2 }).format(amount);
}
