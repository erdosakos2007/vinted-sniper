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
