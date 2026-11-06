import { clearSession } from "./_shared";
export async function onRequestPost(){return Response.json({ok:true},{headers:{"Set-Cookie":clearSession}});}
