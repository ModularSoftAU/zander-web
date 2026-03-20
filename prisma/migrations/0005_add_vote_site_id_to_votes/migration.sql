-- Migration 0005: Add vote_site_id to the votes table
--
-- The votes table may have been created from an older schema that pre-dated
-- the vote_sites FK relationship.  This migration adds the missing column
-- (and its index) using IF NOT EXISTS so it is safe to run even if the
-- column already exists.

-- Add the column (NULL allowed so existing rows are not rejected)
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS vote_site_id INT UNSIGNED NULL DEFAULT NULL AFTER id;

-- Add the composite index used by leaderboard queries.
-- CREATE INDEX IF NOT EXISTS is valid from MySQL 8.0 onward and is safe to
-- re-run: it is a no-op when the index already exists.
CREATE INDEX IF NOT EXISTS idx_month_site ON votes (month_key, vote_site_id);
