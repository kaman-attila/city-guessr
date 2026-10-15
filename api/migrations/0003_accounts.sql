-- Migration number: 0003 	 2026-10-15T21:38:32.117Z
CREATE TABLE users (
  id         INTEGER PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,              
  pw_hash    TEXT NOT NULL,                     
  best_score INTEGER NOT NULL DEFAULT 0,
  theme      TEXT NOT NULL DEFAULT 'system',    
  units      TEXT NOT NULL DEFAULT 'metric',    
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                  
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL                  
) WITHOUT ROWID;