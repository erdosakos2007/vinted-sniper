-- Safe to run repeatedly: this schema does not drop or erase existing data.
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price REAL NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL DEFAULT 'HUF',
  brand TEXT,
  size TEXT,
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','plus','premium')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deals_tier ON deals(tier);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at DESC);

CREATE TABLE IF NOT EXISTS site_presence (
  visitor_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX'
);
CREATE INDEX IF NOT EXISTS idx_site_presence_last_seen ON site_presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_site_presence_country_last_seen ON site_presence(country_code, last_seen);

CREATE TABLE IF NOT EXISTS discord_presence_message (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
