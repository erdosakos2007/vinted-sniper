export type AuthEnv = { DB?: D1; AUTH_SECRET?: string; OWNER_EMAIL?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; DISCORD_CLIENT_ID?: string; DISCORD_CLIENT_SECRET?: string; DISCORD_BOT_TOKEN?: string; DISCORD_GUILD_ID?: string; DISCORD_REGISTRATION_WEBHOOK?: string; RESEND_API_KEY?: string; EMAIL_FROM?: string };
type D1Stmt = { bind(...values: unknown[]): D1Stmt; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{results?:T[]}>; run(): Promise<unknown> };
export type D1 = { prepare(sql: string): D1Stmt };
export type UserSession = { userId: string; displayName: string; email: string | null; avatarUrl: string | null; exp: number };
const COOKIE = "vs_session";
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function unb64(value: string) { const s=value.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0)); }
async function sign(value: string, secret: string) { const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]); return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)))); }
export async function sessionFrom(request: Request, env: AuthEnv): Promise<UserSession|null> { const raw=request.headers.get("Cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1); if(!raw||!env.AUTH_SECRET)return null; const [payload,signature]=raw.split("."); if(!payload||!signature||await sign(payload,env.AUTH_SECRET)!==signature)return null; try { const user=JSON.parse(new TextDecoder().decode(unb64(payload))) as UserSession; return user.exp>Date.now()/1000?user:null; } catch{return null;} }
export async function setSession(user: Omit<UserSession,"exp">, secret: string) { const payload=b64(new TextEncoder().encode(JSON.stringify({...user,exp:Math.floor(Date.now()/1000)+60*60*24*30}))); return `${COOKIE}=${payload}.${await sign(payload,secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`; }
export const clearSession = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function error(message: string,status=400){return Response.json({message},{status});}
export function isOwnerEmail(email: string | null | undefined, env: AuthEnv) { return Boolean(email && env.OWNER_EMAIL && email.trim().toLowerCase() === env.OWNER_EMAIL.trim().toLowerCase()); }
export function callbackUrl(request: Request, provider: string){return `${new URL(request.url).origin}/api/auth/${provider}/callback`;}
export async function upsertIdentity(env: AuthEnv, provider: "google"|"discord", providerId: string, displayName: string, email: string|null, avatarUrl: string|null, linkUserId?: string) {
 if(!env.DB)throw new Error("Database unavailable");
 const existing=await env.DB.prepare("SELECT user_id FROM oauth_identities WHERE provider=? AND provider_user_id=?").bind(provider,providerId).first<{user_id:string}>();
 if(existing){if(linkUserId&&existing.user_id!==linkUserId)throw new Error("This provider account is already linked to another Vinted Sniper account.");return existing.user_id;}
 let userId=linkUserId;
 if(!userId&&email){const match=await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(email).first<{id:string}>();userId=match?.id;}
 if(!userId)userId=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO users (id,email,display_name,avatar_url) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=COALESCE(users.email,excluded.email),display_name=excluded.display_name,avatar_url=COALESCE(excluded.avatar_url,users.avatar_url),updated_at=unixepoch()").bind(userId,email,displayName,avatarUrl).run();
 await env.DB.prepare("INSERT INTO oauth_identities(provider,provider_user_id,user_id,email) VALUES (?,?,?,?)").bind(provider,providerId,userId,email).run();
 return userId;
}
