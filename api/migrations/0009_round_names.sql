-- Migration number: 0009 	 2026-10-21T18:00:00.000Z
CREATE TABLE round_names (
  round   INTEGER NOT NULL,
  cum     REAL NOT NULL,
  name_id INTEGER NOT NULL,
  PRIMARY KEY (round, cum)
) WITHOUT ROWID;

CREATE TABLE daily_names (
  date     TEXT PRIMARY KEY,
  name_ids TEXT NOT NULL
) WITHOUT ROWID;
