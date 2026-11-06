# main.py
import asyncio
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncpg

app = FastAPI(title="VintedSniper Production Backend")

# CORS engedélyezése a Cloudflare-en lévő weboldaladnak
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- A TE SUPABASE ADATBÁZIS LINKED ---
DATABASE_URL = os.environ["postgresql://postgres.chbgqnurbbzcltfykztl:Akoska10...@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"]

# 24 Prémium márka
TARGET_BRANDS = [
    "Ralph Lauren", "Tommy Hilfiger", "Lacoste", "Hugo Boss", "Stone Island",
    "Moncler", "Canada Goose", "Burberry", "Gucci", "Prada", "Balenciaga",
    "Louis Vuitton", "Maison Margiela", "AMI Paris", "Guess", "The North Face",
    "Trapstar", "Essentials", "A Bathing Ape", "Supreme", "Stüssy", "Nike", "Adidas", "Jordan"
]

MIN_PRICE_HUF = 2500
BLOCKED_KEYWORDS = ["csere", "don't buy", "dont buy", "fake", "replika", "keresem", "kepcsere"]

# Discord Webhook URL-ek
WEBHOOKS = {
    "free_deals": "",
    "premium_deals": "",
    "premium_drops": "",
}

async def send_discord(url: str, title: str, desc: str, price: int, item_url: str, img: str):
    if not url: return
    async with httpx.AsyncClient() as client:
        payload = {
            "embeds": [{
                "title": title, "description": desc, "color": 3066993,
                "fields": [{"name": "💰 Ár", "value": f"{price} HUF", "inline": True}, {"name": "🔗 Link", "value": f"[Megtekintés]({item_url})", "inline": True}],
                "image": {"url": img} if img else {}
            }]
        }
        await client.post(url, json=payload)

async def background_vinted_scraper():
    """Valódi Vinted scraper motor a háttérben, 2 percenként frissít"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.vinted.hu/"
    }

    while True:
        try:
            conn = await asyncpg.connect(DATABASE_URL)
            async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
                
                # Lekérjük a Vinted főoldalát a session cookie-k megszerzéséhez
                try:
                    init_res = await client.get("https://www.vinted.hu/")
                    cookies = init_res.cookies
                except Exception:
                    cookies = {}

                for brand in TARGET_BRANDS:
                    try:
                        search_url = f"https://www.vinted.hu/api/v2/catalog/items?search_text={brand}&order=newest_first&per_page=10"
                        response = await client.get(search_url, cookies=cookies)
                        
                        if response.status_code != 200:
                            await asyncio.sleep(5)
                            continue

                        data = response.json()
                        items = data.get("items", [])

                        for item in items:
                            vinted_id = str(item.get("id"))
                            title = item.get("title")
                            price_str = item.get("price")
                            
                            if not price_str or not title: 
                                continue
                                
                            price = float(price_str)
                            url = item.get("url")
                            
                            photo = item.get("photo")
                            image_url = photo.get("url") if photo else ""

                            # Szűrések
                            if price < MIN_PRICE_HUF: 
                                continue
                            if any(bw in title.lower() for bw in BLOCKED_KEYWORDS): 
                                continue

                            existing = await conn.fetchrow("SELECT price FROM vinted_items WHERE vinted_id = $1", vinted_id)

                            if not existing:
                                await conn.execute(
                                    "INSERT INTO vinted_items (vinted_id, title, brand, price, url, image_url) VALUES ($1, $2, $3, $4, $5, $6)",
                                    vinted_id, title, brand, price, url, image_url
                                )
                                if price < 10000:
                                    await send_discord(WEBHOOKS["premium_deals"], "🚀 PREMIUM EXCLUSIVE DEAL", title, int(price), url, image_url)
                                else:
                                    await send_discord(WEBHOOKS["free_deals"], "📢 Free Deal Alert", title, int(price), url, image_url)

                            elif existing["price"] > price:
                                old_price = existing["price"]
                                await conn.execute("UPDATE vinted_items SET price = $1 WHERE vinted_id = $2", price, vinted_id)
                                await send_discord(WEBHOOKS["premium_drops"], "📉 PREMIUM PRICE DROP", f"**{title}** ára leesett!\nRégi ár: {int(old_price)} HUF", int(price), url, image_url)

                        await asyncio.sleep(3) # Kíméljük a Vinted szerverét márkák között

                    except Exception as brand_err:
                        print(f"Hiba a(z) {brand} márka feldolgozásakor: {brand_err}")

            await conn.close()
        except Exception as e:
            print(f"Hiba a scraperben: {e}")

        await asyncio.sleep(120)

@app.on_event("startup")
async def startup():
    asyncio.create_task(background_vinted_scraper())

@app.get("/api/deals")
async def get_deals(tier: str = Query("free")):
    """Visszaadja a termékeket ár szerint növekvőbe a csomagtól függően"""
    conn = await asyncpg.connect(DATABASE_URL)
    limit = 5 if tier == "free" else (30 if tier == "plus" else 60)
    rows = await conn.fetch("SELECT * FROM vinted_items ORDER BY price ASC LIMIT $1", limit)
    await conn.close()
    return {"tier": tier, "count": len(rows), "items": [dict(r) for r in rows]}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
