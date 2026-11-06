type Statement={bind(...values:unknown[]):Statement;all<T=Record<string,unknown>>():Promise<{results?:T[]}>};
type LimitStmt={bind(...values:unknown[]):LimitStmt;run():Promise<{meta?:{changes?:number}}>;};
type Env={DB?:{prepare(sql:string):LimitStmt};EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string};
type Context={request:Request;env:Env};
type EbayItem={title?:string;itemWebUrl?:string;conditionId?:string;price?:{value?:string;currency?:string};}
type TokenResponse={access_token?:string;expires_in?:number;error_description?:string};
type SearchResponse={itemSummaries?:EbayItem[];total?:number;errors?:{message?:string}[]};
type FxRates={rates?:Record<string,number>};
const conditionIds:Record<string,string>={new_tags:"1000|1500",new_no_tags:"1000|1500",very_good:"3000|4000",good:"4000|5000",satisfactory:"5000|6000"};
const markets=[{id:"EBAY_DE",label:"eBay Germany"},{id:"EBAY_GB",label:"eBay UK"},{id:"EBAY_US",label:"eBay US"}];
let cachedToken="";let tokenExpiresAt=0;
async function getEbayToken(env:Env){
 if(cachedToken&&Date.now()<tokenExpiresAt)return cachedToken;
 const response=await fetch("https://api.ebay.com/identity/v1/oauth2/token",{method:"POST",headers:{Authorization:`Basic ${btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",scope:"https://api.ebay.com/oauth/api_scope"})});
 const data=await response.json() as TokenResponse;if(!response.ok||!data.access_token)throw new Error(data.error_description||"eBay authorization failed.");cachedToken=data.access_token;tokenExpiresAt=Date.now()+Math.max(60,(data.expires_in||7200)-120)*1000;return cachedToken;
}
function percentile(sorted:number[],p:number){return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]}
export async function onRequestPost({request,env}:Context){
 const origin=request.headers.get("Origin");if(origin&&origin!==new URL(request.url).origin)return Response.json({message:"Request rejected."},{status:403});
 if(!env.DB)return Response.json({message:"Market estimate service is not configured."},{status:503});
 if(!env.EBAY_CLIENT_ID||!env.EBAY_CLIENT_SECRET)return Response.json({message:"The external price source is not connected yet. Add eBay Developer App ID and Cert ID as EBAY_CLIENT_ID and EBAY_CLIENT_SECRET secrets."},{status:503});
 let body:{query?:unknown;size?:unknown;condition?:unknown;buyPrice?:unknown};try{body=await request.json() as typeof body}catch{return Response.json({message:"Invalid request."},{status:400})}
 const query=typeof body.query==="string"?body.query.trim().slice(0,80):"";const size=typeof body.size==="string"?body.size.trim().slice(0,30):"";const condition=typeof body.condition==="string"?body.condition:"";const buyPrice=Number(body.buyPrice);
 if(query.length<2||!conditionIds[condition]||!Number.isFinite(buyPrice)||buyPrice<=0)return Response.json({message:"Enter the product, size, condition, and purchase price."},{status:400});
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));const clientKey=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");const day=new Date().toISOString().slice(0,10);const quota=await env.DB.prepare("INSERT INTO market_estimate_usage(client_key,day,count) VALUES(?,?,1) ON CONFLICT(client_key,day) DO UPDATE SET count=count+1 WHERE count<20").bind(clientKey,day).run();if(!quota.meta?.changes)return Response.json({message:"Daily estimate limit reached for this network. Try again tomorrow."},{status:429});
 try{
  const token=await getEbayToken(env);const search=`${query} ${size}`.trim();
  const results=await Promise.all(markets.map(async market=>{const params=new URLSearchParams({q:search,limit:"50",filter:`conditionIds:{${conditionIds[condition]}}`});const response=await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,{headers:{Authorization:`Bearer ${token}`,"X-EBAY-C-MARKETPLACE-ID":market.id,Accept:"application/json"}});const data=await response.json() as SearchResponse;if(!response.ok)throw new Error(data.errors?.[0]?.message||`${market.label} search failed (${response.status}).`);return{market:market.label,items:data.itemSummaries||[]}}));
  const listings=results.flatMap(result=>result.items.map(item=>({market:result.market,title:item.title||"Listing",url:item.itemWebUrl||"",value:Number(item.price?.value),currency:item.price?.currency||"",conditionId:item.conditionId||""})).filter(item=>item.url&&Number.isFinite(item.value)&&item.value>0));
  if(!listings.length)return Response.json({message:"No matching listings were found on eBay. Try a broader product name or a common size abbreviation."},{status:404});
  const currencies=[...new Set(listings.map(item=>item.currency))].filter(currency=>currency!=="EUR");let rates:Record<string,number>={EUR:1};if(currencies.length){const response=await fetch(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${currencies.join(",")}`);if(!response.ok)throw new Error("Could not retrieve currency rates for the external listings.");const fx=await response.json() as FxRates;rates={...rates,...fx.rates};}
  const hufPerEur=rates.HUF||400;const normalized=listings.map(item=>({...item,priceHuf:Math.round(item.value*(item.currency==="EUR"?hufPerEur:item.currency==="GBP"?hufPerEur/(rates.GBP||.85):item.currency==="USD"?hufPerEur/(rates.USD||1.08):hufPerEur))}));
  const prices=normalized.map(item=>item.priceHuf).sort((a,b)=>a-b);const average=Math.round(prices.reduce((sum,value)=>sum+value,0)/prices.length);
  const marketCounts=results.map(result=>({market:result.market,count:result.items.filter(item=>item.itemWebUrl&&Number(item.price?.value)>0).length}));
  return Response.json({currency:"HUF",sampleSize:prices.length,average,low:percentile(prices,.2),high:percentile(prices,.8),estimatedGrossProfit:average-buyPrice,marketCounts,samples:normalized.slice(0,8).map(item=>({title:item.title,url:item.url,market:item.market,priceHuf:item.priceHuf})),source:"current active eBay listings across Germany, UK, and US",disclaimer:"This is an average of current asking prices, not completed sales. Availability, shipping, fees, and negotiation may change resale value."},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"Could not load external marketplace prices."},{status:502})}
}
