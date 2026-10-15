-- Migration number: 0002 	 2026-10-15T14:14:32.682Z.
CREATE TABLE daily_plays (
  player_id TEXT NOT NULL,          
  date      TEXT NOT NULL,          
  round     INTEGER NOT NULL DEFAULT 0,  
  score     INTEGER NOT NULL DEFAULT 0,  
  PRIMARY KEY (player_id, date)
) WITHOUT ROWID;

CREATE TABLE daily_hist (
  date   TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, bucket)
) WITHOUT ROWID;

CREATE TABLE guest_ip_counts (
  date    TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, ip_hash)
) WITHOUT ROWID;