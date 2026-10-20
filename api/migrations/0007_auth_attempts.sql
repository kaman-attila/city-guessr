-- Migration number: 0007 	 2026-10-20T10:00:00.000Z
CREATE TABLE auth_attempts (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
) WITHOUT ROWID;
