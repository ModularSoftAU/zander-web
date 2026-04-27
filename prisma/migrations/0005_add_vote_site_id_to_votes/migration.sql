-- Migration 0005: Add vote_site_id to the votes table (MySQL 5.7+ compatible)
--
-- The votes table on some deployments was created from a pre-0003 schema that
-- lacked vote_site_id.  Migration 0003 uses CREATE TABLE IF NOT EXISTS, so it
-- was a no-op on those deployments.  This migration patches the gap.
--
-- If the votes table was accidentally dropped this CREATE TABLE IF NOT EXISTS
-- will recreate it with the full current schema (including vote_site_id).
-- The subsequent PREPARE/EXECUTE blocks are then no-ops because the column
-- and index already exist.
--
-- MySQL 5.7 does not support ADD COLUMN IF NOT EXISTS or
-- CREATE INDEX IF NOT EXISTS, so we use PREPARE/EXECUTE with
-- information_schema checks instead.  Session variables (@var) are
-- visible across statements within the same connection, so Prisma's
-- per-statement execution model works correctly here.

-- 0. Recreate the votes table if it was dropped
CREATE TABLE IF NOT EXISTS votes (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  vote_site_id  INT UNSIGNED  NOT NULL,
  player_uuid   VARCHAR(36)   NOT NULL,
  player_name   VARCHAR(16)   NOT NULL,
  service_name  VARCHAR(64)   NOT NULL,
  received_from VARCHAR(64)   DEFAULT NULL,
  received_at   DATETIME      NOT NULL,
  month_key     CHAR(7)       NOT NULL,
  dedupe_key    VARCHAR(128)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dedupe (dedupe_key),
  KEY idx_uuid_month  (player_uuid, month_key),
  KEY idx_month_site  (month_key, vote_site_id),
  CONSTRAINT fk_votes_site
    FOREIGN KEY (vote_site_id) REFERENCES vote_sites(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1. Add vote_site_id column only if it does not already exist
SET @_col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'votes'
    AND COLUMN_NAME  = 'vote_site_id'
);
SET @_add_col = IF(
  @_col_exists = 0,
  'ALTER TABLE votes ADD COLUMN vote_site_id INT UNSIGNED NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE _migration_stmt FROM @_add_col;
EXECUTE _migration_stmt;
DEALLOCATE PREPARE _migration_stmt;

-- 2. Add composite index only if it does not already exist
SET @_idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME  = 'votes'
    AND INDEX_NAME  = 'idx_month_site'
);
SET @_add_idx = IF(
  @_idx_exists = 0,
  'ALTER TABLE votes ADD INDEX idx_month_site (month_key, vote_site_id)',
  'SELECT 1'
);
PREPARE _migration_stmt FROM @_add_idx;
EXECUTE _migration_stmt;
DEALLOCATE PREPARE _migration_stmt;
