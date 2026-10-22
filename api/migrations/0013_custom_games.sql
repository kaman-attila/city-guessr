-- Migration number: 0013 	 2026-10-23T10:00:00.000Z
DROP TABLE round_names;
CREATE TABLE round_names (
  pool    TEXT NOT NULL,
  round   INTEGER NOT NULL,
  cum     REAL NOT NULL,
  name_id INTEGER NOT NULL,
  PRIMARY KEY (pool, round, cum)
) WITHOUT ROWID;

ALTER TABLE freeplay_games ADD COLUMN pool TEXT NOT NULL DEFAULT 'world';
ALTER TABLE freeplay_games ADD COLUMN level INTEGER;
ALTER TABLE freeplay_games ADD COLUMN seen TEXT NOT NULL DEFAULT '';

CREATE TABLE user_region_bests (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region  TEXT NOT NULL,
  best    INTEGER NOT NULL,
  PRIMARY KEY (user_id, region)
) WITHOUT ROWID;
