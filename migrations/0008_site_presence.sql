CREATE TABLE IF NOT EXISTS site_presence (
  visitor_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_presence_last_seen ON site_presence(last_seen);

CREATE TABLE IF NOT EXISTS discord_presence_message (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
