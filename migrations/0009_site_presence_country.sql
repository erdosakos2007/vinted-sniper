ALTER TABLE site_presence ADD COLUMN country_code TEXT NOT NULL DEFAULT 'XX';
CREATE INDEX IF NOT EXISTS idx_site_presence_country_last_seen
  ON site_presence(country_code, last_seen);
