ALTER TABLE subscriptions ADD COLUMN source TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS email_marketing_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0, 1)),
  unsubscribe_token TEXT UNIQUE,
  opted_in_at INTEGER,
  unsubscribed_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_marketing_opt_in ON email_marketing_preferences(marketing_opt_in, updated_at DESC);

CREATE TABLE IF NOT EXISTS owner_audit_log (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  target_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS owner_email_campaigns (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SENDING',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
