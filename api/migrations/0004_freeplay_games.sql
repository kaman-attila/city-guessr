-- Migration number: 0004 	 2026-10-16T10:00:00.000Z
CREATE TABLE freeplay_games (
  id         TEXT PRIMARY KEY,
  round      INTEGER NOT NULL DEFAULT 0,
  score      INTEGER NOT NULL DEFAULT 0,
  name_id    INTEGER,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX freeplay_games_created_at ON freeplay_games (created_at);
