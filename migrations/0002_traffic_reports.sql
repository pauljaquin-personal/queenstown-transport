CREATE TABLE IF NOT EXISTS traffic_reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  place_id TEXT NOT NULL,
  location TEXT NOT NULL,
  note TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resolved_at TEXT,
  moderation_state TEXT NOT NULL DEFAULT 'unverified' CHECK (moderation_state IN ('unverified','hidden')),
  owner_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_created ON traffic_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_active ON traffic_reports(resolved_at, expires_at);
