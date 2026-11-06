CREATE TABLE IF NOT EXISTS marketplace_ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brand TEXT,
  price_huf INTEGER NOT NULL CHECK (price_huf > 0),
  description TEXT,
  listing_url TEXT NOT NULL,
  image_url TEXT,
  email TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days IN (1, 3, 7, 14, 30, 60)),
  fee_huf INTEGER NOT NULL CHECK (fee_huf >= 200),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED')),
  stripe_session_id TEXT UNIQUE,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace_ads(status, expires_at DESC);
