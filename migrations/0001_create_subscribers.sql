CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_country TEXT,
  source TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email_lower
  ON subscribers(lower(email));

CREATE INDEX IF NOT EXISTS idx_subscribers_created_at
  ON subscribers(created_at DESC);
