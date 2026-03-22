-- Migration 0005: Add vote_site_id to the votes table (MySQL 5.7+ compatible)
--
-- The votes table on some deployments was created from a pre-0003 schema that
-- lacked vote_site_id.  Migration 0003 uses CREATE TABLE IF NOT EXISTS, so it
-- was a no-op on those deployments.  This migration patches the gap.
--
-- MySQL 5.7 does not support ADD COLUMN IF NOT EXISTS or
-- CREATE INDEX IF NOT EXISTS, so we use PREPARE/EXECUTE with
-- information_schema checks instead.  Session variables (@var) are
-- visible across statements within the same connection, so Prisma's
-- per-statement execution model works correctly here.

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
