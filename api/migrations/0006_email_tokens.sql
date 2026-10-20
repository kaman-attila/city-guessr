-- Migration number: 0006 	 2026-10-18T10:00:00.000Z
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX email_tokens_user ON email_tokens (user_id, purpose);
