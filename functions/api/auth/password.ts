import { sessionFrom, type AuthEnv } from "./_shared";
type Context={request:Request;env:AuthEnv};
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hash(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:salt as BufferSource,iterations:310000,hash:"SHA-256"},key,256)))}
export async function onRequestPost({request,env}:Context){
 const user=await sessionFrom(request,env);if(!user||!env.DB)return Response.json({message:"Sign in first to set a password."},{status:401});
 const origin=request.headers.get("Origin");if(origin&&origin!==new URL(request.url).origin)return Response.json({message:"Request rejected."},{status:403});
 let body:{password?:unknown};try{body=await request.json() as typeof body}catch{return Response.json({message:"Invalid request."},{status:400})}
 const password=typeof body.password==="string"?body.password:"";if(password.length<8||password.length>128)return Response.json({message:"Choose a password between 8 and 128 characters."},{status:400});
 const salt=crypto.getRandomValues(new Uint8Array(16));await env.DB.prepare("INSERT INTO email_credentials(user_id,password_salt,password_hash) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,created_at=unixepoch()").bind(user.userId,b64(salt),await hash(password,salt)).run();
 return Response.json({ok:true});
}
