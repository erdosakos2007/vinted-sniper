type Statement = { bind(...values: unknown[]): Statement; run(): Promise<unknown> };
type Env = { STRIPE_SECRET_KEY?: string; DB?: { prepare(sql:string):{bind(...values:unknown[]):{first<T=Record<string,unknown>>():Promise<T|null>}} } };
type Context = { request: Request; env: Env };
const plans = { PRO: { price: 2990, intro: 499, name: "Vinted Sniper Pro" }, PREMIUM: { price: 4990, intro: 999, name: "Vinted Sniper Premium" } } as const;
export async function onRequestPost({ request, env }: Context) {
  if (!env.STRIPE_SECRET_KEY || !env.DB) return Response.json({ message: "Stripe is not configured." }, { status: 503 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Request rejected." }, { status: 403 });
  let data: { email?: unknown; plan?: unknown; currency?: unknown };
  try { data = await request.json() as typeof data; } catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
  const email = typeof data.email === "string" ? data.email.trim().slice(0, 254) : "";
  const plan = data.plan === "PRO" || data.plan === "PREMIUM" ? data.plan : null;
  const currency = typeof data.currency === "string" && ["HUF","EUR","USD","GBP","PLN","RON"].includes(data.currency) ? data.currency : "HUF";
  if (!plan || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Enter a valid email and choose Pro or Premium." }, { status: 400 });
  const product = plans[plan];
  const previousSubscription=await env.DB.prepare("SELECT status FROM subscriptions WHERE lower(user_id)=lower(?)").bind(email).first<{status:string}>();
  const firstMonth= !previousSubscription;
  let rate=1;
  if(currency!=="HUF"){try{const fx=await fetch(`https://api.frankfurter.dev/v1/latest?base=HUF&symbols=${currency}`);const data=await fx.json() as {rates?:Record<string,number>};rate=data.rates?.[currency]||0;}catch{return Response.json({message:"Could not retrieve the latest exchange rate."},{status:503})}if(!rate)return Response.json({message:"Selected currency is not currently supported."},{status:400})}
  const base = new URL(request.url).origin;
  const regularAmount=Math.round(product.price * rate * 100);
  const introAmount=Math.round(product.intro * rate * 100);
  try {
    let couponId="";
    if(firstMonth){
      const couponResponse=await fetch("https://api.stripe.com/v1/coupons",{method:"POST",headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({amount_off:String(Math.max(1,regularAmount-introAmount)),currency:currency.toLowerCase(),duration:"once",name:`${plan} first month`})});
      const coupon=await couponResponse.json() as {id?:string;error?:{message?:string}};
      if(!couponResponse.ok||!coupon.id)return Response.json({message:coupon.error?.message||"Could not apply first-month pricing."},{status:502});
      couponId=coupon.id;
    }
    const form = new URLSearchParams({ mode: "subscription", success_url: `${base}/premium/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${base}/premium?cancelled=1`, customer_email: email, "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": currency.toLowerCase(), "line_items[0][price_data][unit_amount]": String(regularAmount), "line_items[0][price_data][recurring][interval]": "month", "line_items[0][price_data][product_data][name]": product.name, "metadata[plan]": plan, "metadata[email]": email });
    if(couponId)form.set("discounts[0][coupon]",couponId);
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const session = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !session.url) return Response.json({ message: session.error?.message || "Could not start subscription checkout." }, { status: 502 });
    return Response.json({ checkoutUrl: session.url });
  } catch { return Response.json({ message: "Stripe checkout is currently unavailable." }, { status: 502 }); }
}
