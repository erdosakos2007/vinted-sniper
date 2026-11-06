CREATE TABLE IF NOT EXISTS saved_deals (
  user_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  brand TEXT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'HUF',
  url TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, deal_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_deals_id ON saved_deals(deal_id);

CREATE TABLE IF NOT EXISTS price_drop_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  previous_price REAL NOT NULL,
  current_price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'HUF',
  url TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_price_drop_alerts_user ON price_drop_alerts(user_id, seen, detected_at DESC);
