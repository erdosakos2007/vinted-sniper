"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const mainLinks = [
  ["/", "Overview", "◫"],
  ["/deal-hunter", "Deal Hunter", "✳"],
  ["/price-watch", "Saved deals", "♡"],
  ["/marketplace", "Marketplace", "▦"],
  ["/premium", "Plans", "◇"],
] as const;

const titles: Record<string, string> = { "/": "OVERVIEW", "/deal-hunter": "DEAL HUNTER", "/price-watch": "SAVED DEALS", "/recent-searches":"LATEST VINTED SEARCHES", "/marketplace": "MARKETPLACE", "/premium": "PLANS", "/account": "MY ACCOUNT", "/profit-calculator":"PROFIT CALCULATOR", "/owner":"OWNER DASHBOARD" };
const hu:Record<string,string>={
"Overview":"Áttekintés","Deal Hunter":"Ajánlatvadász","Price Watch":"Árfigyelő","Marketplace":"Piactér","Plans":"Csomagok","Latest Vinted search":"Legújabb Vinted-keresés","Saved deals":"Mentett ajánlatok","Find it first.":"Találd meg előbb.","Premium puts the lowest saved deals first.":"A Premium a legolcsóbb mentett ajánlatokat mutatja előre.","View plans":"Csomagok megtekintése","WORKSPACE":"MUNKATERÜLET","Search ready":"Keresésre kész","My Account":"Saját fiók",
"Your next great ":"A következő remek ","deal":"ajánlat"," starts here.":" itt kezdődik.","Search fresh Vinted listings, save deals, and find a better price.":"Keress új Vinted-hirdetéseket, mentsd el az ajánlatokat, és találd meg a jobb árat.","Open Deal Hunter":"Ajánlatvadász megnyitása","Price Watch →":"Árfigyelő →","SAVED DEALS":"MENTETT AJÁNLATOK","In your list":"A listádon","CURRENT PLAN":"JELENLEGI CSOMAG","View plans ↗":"Csomagok ↗","VINTED SEARCH":"VINTED-KERESÉS","Latest listings on Vinted":"Legújabb hirdetések a Vinteden","HELP CENTER":"SÚGÓ","❓ Frequently Asked Questions":"❓ Gyakori kérdések",
"What is Vinted Sniper?":"Mi az a Vinted Sniper?","An independent project being developed to organize second-hand deals.":"Egy független projekt, amely a second-hand ajánlatok rendszerezésére készül.","Is this the official Vinted app?":"Ez a Vinted hivatalos alkalmazása?","No. Vinted Sniper is not affiliated with Vinted.":"Nem. A Vinted Sniper nem áll kapcsolatban a Vinteddel.","Are the products shown on the site real Vinted listings?":"Valódi Vinted-hirdetések láthatók az oldalon?","Currently, the website displays sample product data, not live Vinted listings.":"Jelenleg az oldalon bemutató termékadatok láthatók, nem élő Vinted-hirdetések.","Does the Deal Score verify that a product is authentic?":"A Deal Score igazolja a termék eredetiségét?","No. It is an informational score only and does not authenticate products.":"Nem. Csak tájékoztató pontszám, nem termékhitelesítés.","Does the site buy items or pay for them on my behalf?":"Vásárol vagy fizet helyettem az oldal?","No. Vinted Sniper does not purchase products or handle payments for them.":"Nem. A Vinted Sniper nem vásárol terméket és nem intézi a fizetést.","Are Discord notifications working yet?":"Működnek már a Discord-értesítések?","The Discord server is not connected to the notification system yet. We’ll announce it if that becomes available.":"A Discord-szerver még nincs összekötve az értesítőrendszerrel. Ha elkészül, bejelentjük.","Where can I get help?":"Hol kérhetek segítséget?","Write in the #help channel. Never send your password or sign-in code on Discord.":"Írj a #segítség csatornába. Jelszót vagy belépési kódot ne küldj Discordon.","SMARTER FINDS":"OKOSABB VADÁSZAT","ALL PURCHASES TAKE PLACE ON VINTED":"A VÁSÁRLÁS A VINTEDEN TÖRTÉNIK",
"Welcome ":"Üdv újra, ","back.":"!","Manage your profile, connected sign-in methods, language, and currency.":"Kezeld a profilodat, a kapcsolt bejelentkezéseket, a nyelvet és a pénznemet.","SIGNED IN":"BEJELENTKEZVE","Log out":"Kijelentkezés","Profile":"Profil","Display name":"Megjelenített név","Email address":"E-mail-cím","Save changes":"Módosítások mentése","Connected accounts":"Kapcsolt fiókok","Connected":"Kapcsolva","Reconnect":"Újracsatlakozás","Connect":"Kapcsolás","Preferences":"Beállítások","Language":"Nyelv","Display currency":"Megjelenített pénznem","Subscription":"Előfizetés","Free plan · No active recurring subscription.":"Free csomag · Nincs aktív előfizetés.","Password":"Jelszó","You signed in with an external provider. Change your password in your Google or Discord account. Email/password sign-in is not available yet.":"Külső szolgáltatóval jelentkeztél be. A jelszavadat a Google- vagy Discord-fiókodban módosíthatod.","Login / Register":"Bejelentkezés / Regisztráció","Use email and password, Google, or Discord.":"Lépj be e-mail-címmel, Google- vagy Discord-fiókkal.","Log in":"Bejelentkezés","Register":"Regisztráció","Welcome back":"Üdv újra","Create your account":"Fiók létrehozása","Continue with Google":"Folytatás Google-lel","Continue with Discord":"Folytatás Discorddal","OR CONTINUE WITH":"VAGY FOLYTATÁS EZZEL",
"My Marketplace listings":"Piactéri hirdetéseim","Create a listing and check its status":"Hirdetés feladása és állapotának ellenőrzése","Vinted listings you have saved":"Mentett Vinted-hirdetéseid","My subscription":"Előfizetésem","Free, Pro, and Premium plans":"Free, Pro és Premium csomagok",
"Choose what ":"Válaszd azt, ami ","works for you.":"neked való.","Your plan controls how many saved deals you can see and how they are sorted.":"A csomag határozza meg a megjelenő mentett ajánlatok számát és sorrendjét.","Monthly subscriptions":"Havi előfizetések","Pro and Premium are billed monthly through Stripe Checkout. Enter your email to continue. The Free plan remains free.":"A Pro és Premium havonta, Stripe-on keresztül fizetendő. A folytatáshoz add meg az e-mail-címed. A Free csomag ingyenes.","EMAIL FOR YOUR SUBSCRIPTION":"ELŐFIZETÉSI E-MAIL-CÍM","POPULAR":"NÉPSZERŰ","Get started for free.":"Kezdd el ingyen.","Find the middle ground.":"Találd meg az arany középutat.","See the best prices first.":"Lásd először a legjobb árakat.","Current plan":"Jelenlegi csomag","Select Free":"Free kiválasztása","Subscribe to Pro":"Feliratkozás Pro csomagra","Subscribe to Premium":"Feliratkozás Premium csomagra","Opening Stripe…":"Stripe megnyitása…","Plan access is saved in this browser after checkout. Subscription cancellation and cross-device account sync require account login and Stripe webhooks.":"A csomag a fizetés után ebben a böngészőben lesz elmentve. A lemondáshoz és az eszközök közötti szinkronhoz bejelentkezés és Stripe-webhook szükséges.",
"VINTED SNIPER · LISTINGS":"VINTED SNIPER · HIRDETÉSEK","Marketplace ":"Piactéri ","listings.":"hirdetések.","Promote your Vinted listing. Choose how long it stays visible, pay online, and it will appear after payment.":"Emeld ki a Vinted-hirdetésedet. Válaszd ki a megjelenés idejét, fizess online, és a hirdetésed sikeres fizetés után megjelenik.","NEW LISTING":"ÚJ HIRDETÉS","Listing details":"Hirdetés adatai","Product name":"Termék neve","Brand":"Márka","Asking price (HUF)":"Eladási ár (HUF)","Vinted listing URL":"Vinted-hirdetés URL-je","Image URL (optional)":"Kép URL-je (nem kötelező)","Description (optional)":"Leírás (nem kötelező)","Listing duration":"Megjelenés időtartama"," days":" nap","Continue to payment":"Tovább a fizetéshez","Starting checkout…":"Fizetés indítása…","PUBLISHED LISTINGS":"AKTÍV HIRDETÉSEK","No active listings yet.":"Még nincsenek aktív hirdetések.","Successfully paid listings will appear here until they expire.":"A sikeresen kifizetett hirdetések a lejáratukig itt jelennek meg.",
"DEAL HUNTER · ":"AJÁNLATVADÁSZ · "," PLAN":" CSOMAG","Vinted deals,":"Vinted-ajánlatok,","all in one place.":"egy helyen.","Search Vinted, then save the listings you want to keep an eye on.":"Keress a Vinteden, majd mentsd el a figyelni kívánt hirdetéseket.","WHAT ARE YOU LOOKING FOR?":"MIT KERESEL?","SHARED VINTED LIST":"KÖZÖS VINTED-LISTA","Refresh ↻":"Frissítés ↻","No saved deals yet.":"Még nincsenek mentett ajánlatok.","Add a Vinted listing":"Vinted-hirdetés hozzáadása","Save deal":"Ajánlat mentése","Open ↗":"Megnyitás ↗",
"PRICE WATCH · VINTED":"ÁRFIGYELŐ · VINTED","Search for what ":"Keresd meg, amit ","you want.":"szeretnél.","PRODUCT OR BRAND":"TERMÉK VAGY MÁRKA","Search Vinted ↗":"Keresés a Vinteden ↗","RECENTLY SAVED DEALS":"LEGUTÓBB MENTETT AJÁNLATOK","Price watch list":"Árfigyelő lista","MATCHES IN SHARED LIST":"TALÁLATOK A KÖZÖS LISTÁBAN","No deals on your watch list yet.":"Még nincs figyelt ajánlat.","Open Deal Hunter →":"Ajánlatvadász megnyitása →"
};
function applyLanguage(){const language=localStorage.getItem("vs-language")||"en";document.documentElement.lang=language;if(language!=="hu")return;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const value=node.nodeValue||"",trimmed=value.trim(),translated=hu[trimmed];if(translated)node.nodeValue=value.replace(trimmed,translated)}document.title="Vinted Sniper — Okosabb vadászat, jobb dealek";}

export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    const storageKey = "vs-presence-id";
    let visitorId = localStorage.getItem(storageKey);
    if (!visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(storageKey, visitorId);
    }
    const heartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/visitors/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
        keepalive: true,
      }).catch(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 45_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, []);
  useEffect(()=>{void fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).then((d:{user?:{isOwner?:boolean}|null})=>setOwner(Boolean(d.user?.isOwner))).catch(()=>setOwner(false));},[pathname]);
  useEffect(()=>{applyLanguage();const observer=new MutationObserver(()=>applyLanguage());observer.observe(document.body,{childList:true,subtree:true,characterData:true});const onChange=()=>applyLanguage();window.addEventListener("vs-language-change",onChange);return()=>{observer.disconnect();window.removeEventListener("vs-language-change",onChange)}},[pathname]);
  return <>
    <aside className="sidebar">
      <a className="brand-lockup" href="/" aria-label="Vinted Sniper home"><span className="brand-mark">VS</span><span className="brand-name">VINTED<span>SNIPER</span><small>SMART FINDS. BETTER DEALS.</small></span></a>
      <div className="side-label">MENU</div>
      <nav className="side-nav" aria-label="Main navigation">{mainLinks.map(([href, label, icon]) => <a key={href} className={`nav-link${pathname === href ? " active" : ""}`} href={href}><span className="nav-icon">{icon}</span><span className="nav-text">{label}</span></a>)}</nav>
      <div className="side-label tools-label">TOOLS</div>
      <nav className="side-nav" aria-label="More tools">
        <a className={`nav-link${pathname === "/recent-searches" ? " active" : ""}`} href="/recent-searches"><span className="nav-icon">⌁</span><span className="nav-text">Latest Vinted searches</span></a>
        <a className={`nav-link${pathname === "/profit-calculator" ? " active" : ""}`} href="/profit-calculator"><span className="nav-icon">↗</span><span className="nav-text">Profit calculator</span></a>
        {owner&&<a className={`nav-link${pathname === "/owner" ? " active" : ""}`} href="/owner"><span className="nav-icon">⚙</span><span className="nav-text">Owner dashboard</span></a>}
      </nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-spark">✳</span><strong>{owner?"Owner access active":"Find it first."}</strong><p>{owner?"Premium access is unlocked for your account.":"Premium puts the lowest saved deals first."}</p><a className="upgrade-button" href={owner?"/account":"/premium"}>{owner?"My account":"View plans"} <span>↗</span></a></div></div>
    </aside>
    <div className="main-panel">
      <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> <strong>{titles[pathname] || "VINTED SNIPER"}</strong></div><div className="top-actions"><span className="system-status"><i/> Search ready</span><a className="account-top-button" href="/account"><span className="avatar">V</span><span>My Account</span></a></div></header>
      {children}
    </div>
  </>;
}
