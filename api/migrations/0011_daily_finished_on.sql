-- Migration number: 0011 	 2026-10-22T16:00:00.000Z
ALTER TABLE daily_plays ADD COLUMN finished_on TEXT;
UPDATE daily_plays SET finished_on = date WHERE round >= 5;
