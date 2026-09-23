CREATE TABLE IF NOT EXISTS commutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_zone TEXT NOT NULL,
  destination_zone TEXT NOT NULL,
  modes TEXT NOT NULL,
  time_band TEXT NOT NULL,
  change_reason TEXT,
  created_month TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commutes_month ON commutes(created_month);
CREATE INDEX IF NOT EXISTS idx_commutes_od ON commutes(origin_zone,destination_zone);
