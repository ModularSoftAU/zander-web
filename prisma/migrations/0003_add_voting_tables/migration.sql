-- Migration 0003: Ensure voting-related tables exist.
--
-- The 0001_baseline migration was recorded as applied on the production database
-- without executing its SQL (the DB already had other tables).  This migration
-- creates the voting tables that were defined in the baseline but are absent from
-- production.  All statements use CREATE TABLE IF NOT EXISTS so they are safe to
-- run even if the tables were created by another means.

-- ============================================================
-- vote_sites
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_sites (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  site_name     VARCHAR(128)  NOT NULL,
  service_name  VARCHAR(64)   NOT NULL,
  vote_url      VARCHAR(512)  NOT NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  display_order INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_name (service_name),
  KEY idx_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- votes
-- ============================================================
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

-- ============================================================
-- vote_monthly_totals
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_monthly_totals (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  player_uuid  VARCHAR(36)   NOT NULL,
  player_name  VARCHAR(16)   NOT NULL,
  month_key    CHAR(7)       NOT NULL,
  vote_count   INT UNSIGNED  NOT NULL DEFAULT 0,
  last_vote_at DATETIME      DEFAULT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_uuid_month  (player_uuid, month_key),
  KEY idx_month_count (month_key, vote_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- vote_monthly_results
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_monthly_results (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  month_key    CHAR(7)       NOT NULL,
  player_uuid  VARCHAR(36)   NOT NULL,
  player_name  VARCHAR(16)   NOT NULL,
  vote_count   INT UNSIGNED  NOT NULL,
  tie_position TINYINT       NOT NULL DEFAULT 1,
  rewarded_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_month_player (month_key, player_uuid),
  KEY idx_month_key (month_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- player_command_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS player_command_queue (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  player_uuid    VARCHAR(36)   NOT NULL,
  player_name    VARCHAR(16)   NOT NULL,
  source         VARCHAR(64)   NOT NULL,
  command_text   VARCHAR(512)  NOT NULL,
  execute_as     ENUM('console','player') NOT NULL DEFAULT 'console',
  status         ENUM('pending','claimed','completed','failed') NOT NULL DEFAULT 'pending',
  server_scope   VARCHAR(64)   NOT NULL DEFAULT 'any',
  dedupe_key     VARCHAR(128)  NOT NULL,
  available_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at     DATETIME      DEFAULT NULL,
  completed_at   DATETIME      DEFAULT NULL,
  failure_reason VARCHAR(512)  DEFAULT NULL,
  retry_count    INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dedupe (dedupe_key),
  KEY idx_claim_lookup (player_uuid, status, server_scope, available_at),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- vote_reward_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_reward_templates (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  reward_type      ENUM('vote','monthly_top') NOT NULL,
  command_template VARCHAR(512)  NOT NULL,
  execute_as       ENUM('console','player') NOT NULL DEFAULT 'console',
  server_scope     VARCHAR(64)   NOT NULL DEFAULT 'any',
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  display_order    INT           NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_type_active (reward_type, is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default reward templates (safe to re-run — INSERT IGNORE skips duplicates)
INSERT IGNORE INTO vote_reward_templates (id, reward_type, command_template, execute_as, server_scope, display_order) VALUES
  (1, 'vote',        'crate key give {player} vote 1',                                                          'console', 'any', 0),
  (2, 'vote',        'eco give {player} 250',                                                                   'console', 'any', 1),
  (3, 'monthly_top', 'lp user {player} parent addtemp topvoter 30d',                                            'console', 'any', 0),
  (4, 'monthly_top', 'broadcast &6[Vote] &e{player} &awon top voter for &6{month}&a! Congratulations!',         'console', 'any', 1),
  (5, 'monthly_top', 'crate key give {player} vote 10',                                                         'console', 'any', 2);
