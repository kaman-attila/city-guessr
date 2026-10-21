-- Migration number: 0008 	 2026-10-21T12:00:00.000Z
CREATE TABLE user_identities (
  provider   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
) WITHOUT ROWID;

CREATE INDEX user_identities_user ON user_identities (user_id);
