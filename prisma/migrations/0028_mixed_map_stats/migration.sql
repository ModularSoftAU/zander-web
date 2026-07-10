-- =============================================================================
-- Migration 0028: Per-map stats and records for the Mixed module
-- =============================================================================
-- Adds the columns zander-pgm now sends on kill/death/objective events and
-- match-end player payloads, plus two new tables to back per-map
-- leaderboards ("most kills on a map", "best K/D on a map", "best killstreak
-- on a map") and per-map single-event records ("longest shot", "furthest bow
-- kill", "most kills in one match").
-- =============================================================================

-- Structured kill/death/objective fields on the raw event timeline ------------
ALTER TABLE `mixed_match_events`
    ADD COLUMN `map_key`               VARCHAR(160)  NULL AFTER `match_id`,
    ADD COLUMN `assister_uuid`         VARCHAR(36)   NULL AFTER `target_uuid`,
    ADD COLUMN `assister_username`     VARCHAR(64)   NULL AFTER `assister_uuid`,
    ADD COLUMN `cause`                 VARCHAR(80)   NULL AFTER `assister_username`,
    ADD COLUMN `weapon`                VARCHAR(80)   NULL AFTER `cause`,
    ADD COLUMN `is_projectile`         TINYINT(1)    NULL AFTER `weapon`,
    ADD COLUMN `is_bow_kill`           TINYINT(1)    NULL AFTER `is_projectile`,
    ADD COLUMN `distance`              DOUBLE        NULL AFTER `is_bow_kill`,
    ADD COLUMN `team_kill`             TINYINT(1)    NULL AFTER `distance`,
    ADD COLUMN `objective_type`        VARCHAR(60)   NULL AFTER `team_kill`,
    ADD COLUMN `objective_id`          VARCHAR(120)  NULL AFTER `objective_type`,
    ADD COLUMN `objective_name`        VARCHAR(160)  NULL AFTER `objective_id`,
    ADD COLUMN `action`                VARCHAR(40)   NULL AFTER `objective_name`,
    ADD COLUMN `capture_time_seconds`  INT           NULL AFTER `action`,
    ADD COLUMN `location`              JSON          NULL AFTER `capture_time_seconds`,
    ADD INDEX `mixed_match_events_map_idx` (`map_key`),
    ADD INDEX `mixed_match_events_distance_idx` (`map_key`, `distance`),
    ADD INDEX `mixed_match_events_bow_kill_idx` (`map_key`, `is_bow_kill`, `distance`);

-- Extended per-match player stats ----------------------------------------------
ALTER TABLE `mixed_match_players`
    ADD COLUMN `captures`                INT     NOT NULL DEFAULT 0 AFTER `objectives`,
    ADD COLUMN `wool_captures`           INT     NOT NULL DEFAULT 0 AFTER `captures`,
    ADD COLUMN `flag_captures`           INT     NOT NULL DEFAULT 0 AFTER `wool_captures`,
    ADD COLUMN `core_leaks`              INT     NOT NULL DEFAULT 0 AFTER `flag_captures`,
    ADD COLUMN `destroyable_damage`      DOUBLE  NOT NULL DEFAULT 0 AFTER `core_leaks`,
    ADD COLUMN `control_point_captures`  INT     NOT NULL DEFAULT 0 AFTER `destroyable_damage`,
    ADD COLUMN `best_killstreak`         INT     NOT NULL DEFAULT 0 AFTER `control_point_captures`,
    ADD COLUMN `longest_shot`            DOUBLE  NOT NULL DEFAULT 0 AFTER `best_killstreak`,
    ADD COLUMN `furthest_bow_kill`       DOUBLE  NOT NULL DEFAULT 0 AFTER `longest_shot`;

-- Career per-map-per-player aggregate stats (leaderboards) --------------------
CREATE TABLE `mixed_map_player_totals` (
    `map_key`                 VARCHAR(160) NOT NULL,
    `player_uuid`             VARCHAR(36)  NOT NULL,
    `username`                VARCHAR(64)  NULL,
    `matches_played`          INT          NOT NULL DEFAULT 0,
    `wins`                    INT          NOT NULL DEFAULT 0,
    `losses`                  INT          NOT NULL DEFAULT 0,
    `kills`                   INT          NOT NULL DEFAULT 0,
    `deaths`                  INT          NOT NULL DEFAULT 0,
    `assists`                 INT          NOT NULL DEFAULT 0,
    `objectives`              INT          NOT NULL DEFAULT 0,
    `captures`                INT          NOT NULL DEFAULT 0,
    `wool_captures`           INT          NOT NULL DEFAULT 0,
    `flag_captures`           INT          NOT NULL DEFAULT 0,
    `core_leaks`              INT          NOT NULL DEFAULT 0,
    `destroyable_damage`      DOUBLE       NOT NULL DEFAULT 0,
    `control_point_captures`  INT          NOT NULL DEFAULT 0,
    `best_killstreak`         INT          NOT NULL DEFAULT 0,
    `longest_shot`            DOUBLE       NOT NULL DEFAULT 0,
    `furthest_bow_kill`       DOUBLE       NOT NULL DEFAULT 0,
    `playtime_seconds`        BIGINT       NOT NULL DEFAULT 0,
    `updated_at`              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`map_key`, `player_uuid`),
    INDEX `mixed_map_player_totals_kills_idx` (`map_key`, `kills`),
    INDEX `mixed_map_player_totals_killstreak_idx` (`map_key`, `best_killstreak`),
    INDEX `mixed_map_player_totals_player_idx` (`player_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Single-event / single-match per-map records ----------------------------------
CREATE TABLE `mixed_map_records` (
    `map_key`      VARCHAR(160) NOT NULL,
    `record_type`  VARCHAR(40)  NOT NULL,
    `player_uuid`  VARCHAR(36)  NULL,
    `username`     VARCHAR(64)  NULL,
    `value`        DOUBLE       NOT NULL DEFAULT 0,
    `match_id`     VARCHAR(64)  NULL,
    `achieved_at`  DATETIME     NULL,
    `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`map_key`, `record_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
