CREATE TABLE IF NOT EXISTS market_estimate_usage (
  client_key TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_key, day)
);
