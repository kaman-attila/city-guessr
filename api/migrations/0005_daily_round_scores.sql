-- Migration number: 0005 	 2026-10-17T10:00:00.000Z
-- comma-separated score of each answered round, e.g. "998,938,712"
ALTER TABLE daily_plays ADD COLUMN scores TEXT NOT NULL DEFAULT '';
