-- =============================================================================
-- Migration 0026: Mixed module (public PGM stats portal for zander-pgm)
-- =============================================================================
-- Adds all mixed_* tables that back the Mixed public/admin website module:
--   servers, maps, matches, match players/events, player/map totals,
--   map tokens (balances/transactions/requests), map voting, map ratings,
--   achievements, ranks and entitlements.
--
-- All tables use utf8mb4 and InnoDB. Money/token amounts are plain integers.
-- JSON columns store flexible plugin-supplied payloads.
-- =============================================================================

-- Connected zander-pgm servers ------------------------------------------------
CREATE TABLE `mixed_servers` (
    `server_id`             VARCHAR(64)   NOT NULL,
    `display_name`          VARCHAR(150)  NOT NULL,
    `environment`           VARCHAR(40)   NOT NULL DEFAULT 'production',
    `online`                TINYINT(1)    NOT NULL DEFAULT 0,
    `current_match_id`      VARCHAR(64)   NULL,
    `current_map_key`       VARCHAR(160)  NULL,
    `current_map_name`      VARCHAR(200)  NULL,
    `player_count`          INT           NOT NULL DEFAULT 0,
    `tps`                   DECIMAL(5,2)  NULL,
    `pgm_version`           VARCHAR(60)   NULL,
    `zander_pgm_version`    VARCHAR(60)   NULL,
    `last_heartbeat_at`     DATETIME      NULL,
    `metadata`              JSON          NULL,
    `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`server_id`),
    INDEX `mixed_servers_online_idx` (`online`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Maps ------------------------------------------------------------------------
CREATE TABLE `mixed_maps` (
    `map_key`                   VARCHAR(160)  NOT NULL,
    `name`                      VARCHAR(200)  NOT NULL,
    `version`                   VARCHAR(60)   NULL,
    `gamemode`                  VARCHAR(60)   NULL,
    `authors`                   JSON          NULL,
    `description`               TEXT          NULL,
    `thumbnail_url`             VARCHAR(512)  NULL,
    `tags`                      JSON          NULL,
    `objectives`                JSON          NULL,
    `first_seen_at`             DATETIME      NULL,
    `last_played_at`            DATETIME      NULL,
    `times_played`              INT           NOT NULL DEFAULT 0,
    `average_duration_seconds`  INT           NOT NULL DEFAULT 0,
    `public_visible`            TINYINT(1)    NOT NULL DEFAULT 1,
    `voting_enabled`            TINYINT(1)    NOT NULL DEFAULT 1,
    `token_enabled`             TINYINT(1)    NOT NULL DEFAULT 1,
    `blacklisted_from_voting`   TINYINT(1)    NOT NULL DEFAULT 0,
    `blacklisted_from_tokens`   TINYINT(1)    NOT NULL DEFAULT 0,
    `created_at`                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`map_key`),
    INDEX `mixed_maps_gamemode_idx` (`gamemode`),
    INDEX `mixed_maps_visible_idx` (`public_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Matches ---------------------------------------------------------------------
CREATE TABLE `mixed_matches` (
    `match_id`            VARCHAR(64)   NOT NULL,
    `server_id`           VARCHAR(64)   NULL,
    `map_key`             VARCHAR(160)  NULL,
    `map_name`            VARCHAR(200)  NULL,
    `gamemode`            VARCHAR(60)   NULL,
    `status`             ENUM('loaded','running','ended','cancelled') NOT NULL DEFAULT 'loaded',
    `started_at`          DATETIME      NULL,
    `ended_at`            DATETIME      NULL,
    `duration_seconds`    INT           NULL,
    `winners`             JSON          NULL,
    `participants_count`  INT           NOT NULL DEFAULT 0,
    `total_kills`         INT           NOT NULL DEFAULT 0,
    `total_deaths`        INT           NOT NULL DEFAULT 0,
    `total_objectives`    INT           NOT NULL DEFAULT 0,
    `metadata`            JSON          NULL,
    `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`match_id`),
    INDEX `mixed_matches_map_idx` (`map_key`),
    INDEX `mixed_matches_server_idx` (`server_id`),
    INDEX `mixed_matches_status_idx` (`status`),
    INDEX `mixed_matches_started_idx` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-match player rows -------------------------------------------------------
CREATE TABLE `mixed_match_players` (
    `id`             INT           NOT NULL AUTO_INCREMENT,
    `match_id`       VARCHAR(64)   NOT NULL,
    `player_uuid`    VARCHAR(36)   NOT NULL,
    `username`       VARCHAR(64)   NULL,
    `team_name`      VARCHAR(80)   NULL,
    `won`            TINYINT(1)    NOT NULL DEFAULT 0,
    `kills`          INT           NOT NULL DEFAULT 0,
    `deaths`         INT           NOT NULL DEFAULT 0,
    `assists`        INT           NOT NULL DEFAULT 0,
    `objectives`     INT           NOT NULL DEFAULT 0,
    `damage_dealt`   DOUBLE        NOT NULL DEFAULT 0,
    `damage_taken`   DOUBLE        NOT NULL DEFAULT 0,
    `xp_earned`      INT           NOT NULL DEFAULT 0,
    `metadata`       JSON          NULL,
    `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_match_players_unique` (`match_id`, `player_uuid`),
    INDEX `mixed_match_players_player_idx` (`player_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Raw match event timeline ----------------------------------------------------
CREATE TABLE `mixed_match_events` (
    `id`            BIGINT        NOT NULL AUTO_INCREMENT,
    `match_id`      VARCHAR(64)   NOT NULL,
    `server_id`     VARCHAR(64)   NULL,
    `event_type`    VARCHAR(60)   NOT NULL,
    `player_uuid`   VARCHAR(36)   NULL,
    `target_uuid`   VARCHAR(36)   NULL,
    `team_name`     VARCHAR(80)   NULL,
    `occurred_at`   DATETIME      NULL,
    `payload`       JSON          NULL,
    `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `mixed_match_events_match_idx` (`match_id`),
    INDEX `mixed_match_events_type_idx` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aggregate player totals -----------------------------------------------------
CREATE TABLE `mixed_player_totals` (
    `player_uuid`             VARCHAR(36)  NOT NULL,
    `username`                VARCHAR(64)  NULL,
    `level`                   INT          NOT NULL DEFAULT 0,
    `total_xp`                BIGINT       NOT NULL DEFAULT 0,
    `matches_played`          INT          NOT NULL DEFAULT 0,
    `wins`                    INT          NOT NULL DEFAULT 0,
    `losses`                  INT          NOT NULL DEFAULT 0,
    `kills`                   INT          NOT NULL DEFAULT 0,
    `deaths`                  INT          NOT NULL DEFAULT 0,
    `assists`                 INT          NOT NULL DEFAULT 0,
    `objectives`              INT          NOT NULL DEFAULT 0,
    `wool_captures`           INT          NOT NULL DEFAULT 0,
    `flag_captures`           INT          NOT NULL DEFAULT 0,
    `core_leaks`              INT          NOT NULL DEFAULT 0,
    `destroyable_damage`      DOUBLE       NOT NULL DEFAULT 0,
    `control_point_captures`  INT          NOT NULL DEFAULT 0,
    `best_killstreak`         INT          NOT NULL DEFAULT 0,
    `playtime_seconds`        BIGINT       NOT NULL DEFAULT 0,
    `last_seen_at`            DATETIME     NULL,
    `updated_at`              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`player_uuid`),
    INDEX `mixed_player_totals_username_idx` (`username`),
    INDEX `mixed_player_totals_xp_idx` (`total_xp`),
    INDEX `mixed_player_totals_wins_idx` (`wins`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aggregate map totals --------------------------------------------------------
CREATE TABLE `mixed_map_totals` (
    `map_key`                 VARCHAR(160) NOT NULL,
    `times_played`            INT          NOT NULL DEFAULT 0,
    `total_duration_seconds`  BIGINT       NOT NULL DEFAULT 0,
    `total_kills`             INT          NOT NULL DEFAULT 0,
    `total_objectives`        INT          NOT NULL DEFAULT 0,
    `team_win_counts`         JSON         NULL,
    `fastest_match_seconds`   INT          NULL,
    `longest_match_seconds`   INT          NULL,
    `last_played_at`          DATETIME     NULL,
    `updated_at`              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`map_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map Token balances ----------------------------------------------------------
CREATE TABLE `mixed_map_token_balances` (
    `player_uuid`      VARCHAR(36)  NOT NULL,
    `username`         VARCHAR(64)  NULL,
    `balance`          INT          NOT NULL DEFAULT 0,
    `lifetime_earned`  INT          NOT NULL DEFAULT 0,
    `lifetime_spent`   INT          NOT NULL DEFAULT 0,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`player_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map Token ledger ------------------------------------------------------------
CREATE TABLE `mixed_map_token_transactions` (
    `id`                          BIGINT       NOT NULL AUTO_INCREMENT,
    `player_uuid`                 VARCHAR(36)  NOT NULL,
    `type`                       ENUM('purchase','spend','grant','remove','refund') NOT NULL,
    `amount`                      INT          NOT NULL,
    `reason`                      VARCHAR(255) NULL,
    `stripe_checkout_session_id`  VARCHAR(191) NULL,
    `stripe_payment_intent_id`    VARCHAR(191) NULL,
    `metadata`                    JSON         NULL,
    `created_at`                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_token_tx_session_unique` (`stripe_checkout_session_id`),
    INDEX `mixed_token_tx_player_idx` (`player_uuid`),
    INDEX `mixed_token_tx_type_idx` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map requests (token spends: nominate / set-next / sponsor) -------------------
CREATE TABLE `mixed_map_requests` (
    `id`               BIGINT       NOT NULL AUTO_INCREMENT,
    `player_uuid`      VARCHAR(36)  NOT NULL,
    `username`         VARCHAR(64)  NULL,
    `map_key`          VARCHAR(160) NOT NULL,
    `action_type`     ENUM('nominate','set_next','sponsor') NOT NULL,
    `token_cost`       INT          NOT NULL DEFAULT 1,
    `status`          ENUM('pending','queued','applied','rejected','expired','refunded','failed') NOT NULL DEFAULT 'pending',
    `requested_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `applied_at`       DATETIME     NULL,
    `refunded_at`      DATETIME     NULL,
    `failure_reason`   VARCHAR(255) NULL,
    `metadata`         JSON         NULL,
    PRIMARY KEY (`id`),
    INDEX `mixed_map_requests_player_idx` (`player_uuid`),
    INDEX `mixed_map_requests_status_idx` (`status`),
    INDEX `mixed_map_requests_map_idx` (`map_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map votes -------------------------------------------------------------------
CREATE TABLE `mixed_map_votes` (
    `vote_id`           VARCHAR(64)  NOT NULL,
    `server_id`         VARCHAR(64)  NULL,
    `status`           ENUM('active','ended','cancelled') NOT NULL DEFAULT 'active',
    `started_at`        DATETIME     NULL,
    `ended_at`          DATETIME     NULL,
    `winning_map_key`   VARCHAR(160) NULL,
    `metadata`          JSON         NULL,
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`vote_id`),
    INDEX `mixed_map_votes_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_map_vote_options` (
    `id`                  BIGINT       NOT NULL AUTO_INCREMENT,
    `vote_id`             VARCHAR(64)  NOT NULL,
    `map_key`             VARCHAR(160) NOT NULL,
    `map_name`            VARCHAR(200) NULL,
    `source`             ENUM('rotation','token','admin') NOT NULL DEFAULT 'rotation',
    `token_request_id`    BIGINT       NULL,
    `base_weight`         INT          NOT NULL DEFAULT 1,
    `token_boost_weight`  INT          NOT NULL DEFAULT 0,
    `final_vote_count`    INT          NOT NULL DEFAULT 0,
    `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_vote_option_unique` (`vote_id`, `map_key`),
    INDEX `mixed_vote_option_vote_idx` (`vote_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_map_vote_casts` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT,
    `vote_id`       VARCHAR(64)  NOT NULL,
    `player_uuid`   VARCHAR(36)  NOT NULL,
    `username`      VARCHAR(64)  NULL,
    `map_key`       VARCHAR(160) NOT NULL,
    `vote_weight`   INT          NOT NULL DEFAULT 1,
    `source`       ENUM('web','ingame') NOT NULL DEFAULT 'web',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_vote_cast_unique` (`vote_id`, `player_uuid`),
    INDEX `mixed_vote_cast_vote_idx` (`vote_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map ratings + feedback ------------------------------------------------------
CREATE TABLE `mixed_map_ratings` (
    `id`                     BIGINT       NOT NULL AUTO_INCREMENT,
    `map_key`                VARCHAR(160) NOT NULL,
    `match_id`               VARCHAR(64)  NOT NULL,
    `player_uuid`            VARCHAR(36)  NOT NULL,
    `username`               VARCHAR(64)  NULL,
    `overall_rating`         TINYINT      NOT NULL,
    `feedback`               TEXT         NULL,
    `feedback_visible`       TINYINT(1)   NOT NULL DEFAULT 1,
    `feedback_hidden_reason` VARCHAR(255) NULL,
    `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_map_rating_unique` (`match_id`, `player_uuid`),
    INDEX `mixed_map_rating_map_idx` (`map_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_map_rating_totals` (
    `map_key`            VARCHAR(160) NOT NULL,
    `rating_count`       INT          NOT NULL DEFAULT 0,
    `average_overall`    DECIMAL(4,2) NOT NULL DEFAULT 0,
    `one_star_count`     INT          NOT NULL DEFAULT 0,
    `two_star_count`     INT          NOT NULL DEFAULT 0,
    `three_star_count`   INT          NOT NULL DEFAULT 0,
    `four_star_count`    INT          NOT NULL DEFAULT 0,
    `five_star_count`    INT          NOT NULL DEFAULT 0,
    `feedback_count`     INT          NOT NULL DEFAULT 0,
    `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`map_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Achievements ----------------------------------------------------------------
CREATE TABLE `mixed_achievements` (
    `achievement_key`  VARCHAR(120) NOT NULL,
    `name`             VARCHAR(160) NOT NULL,
    `description`      TEXT         NULL,
    `rarity`          ENUM('common','uncommon','rare','epic','legendary') NOT NULL DEFAULT 'common',
    `xp_reward`        INT          NOT NULL DEFAULT 0,
    `unlock_count`     INT          NOT NULL DEFAULT 0,
    `icon_url`         VARCHAR(512) NULL,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`achievement_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_player_achievements` (
    `id`                BIGINT       NOT NULL AUTO_INCREMENT,
    `player_uuid`       VARCHAR(36)  NOT NULL,
    `username`          VARCHAR(64)  NULL,
    `achievement_key`   VARCHAR(120) NOT NULL,
    `unlocked_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_player_achievement_unique` (`player_uuid`, `achievement_key`),
    INDEX `mixed_player_achievement_key_idx` (`achievement_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ranks + entitlements --------------------------------------------------------
CREATE TABLE `mixed_ranks` (
    `rank_key`      VARCHAR(80)  NOT NULL,
    `display_name`  VARCHAR(120) NOT NULL,
    `weight`        INT          NOT NULL DEFAULT 0,
    `metadata`      JSON         NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`rank_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_player_ranks` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT,
    `player_uuid`   VARCHAR(36)  NOT NULL,
    `username`      VARCHAR(64)  NULL,
    `rank_key`      VARCHAR(80)  NOT NULL,
    `expires_at`    DATETIME     NULL,
    `sync_status`  ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending',
    `synced_at`     DATETIME     NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_player_rank_unique` (`player_uuid`, `rank_key`),
    INDEX `mixed_player_rank_status_idx` (`sync_status`),
    INDEX `mixed_player_rank_expiry_idx` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_entitlements` (
    `entitlement_key`  VARCHAR(80)  NOT NULL,
    `display_name`     VARCHAR(120) NOT NULL,
    `description`      TEXT         NULL,
    `metadata`         JSON         NULL,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`entitlement_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mixed_player_entitlements` (
    `id`                 BIGINT       NOT NULL AUTO_INCREMENT,
    `player_uuid`        VARCHAR(36)  NOT NULL,
    `username`           VARCHAR(64)  NULL,
    `entitlement_key`    VARCHAR(80)  NOT NULL,
    `expires_at`         DATETIME     NULL,
    `sync_status`       ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending',
    `synced_at`          DATETIME     NULL,
    `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `mixed_player_entitlement_unique` (`player_uuid`, `entitlement_key`),
    INDEX `mixed_player_entitlement_status_idx` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook idempotency for Stripe map-token fulfilment -------------------------
CREATE TABLE `mixed_stripe_webhook_events` (
    `event_id`     VARCHAR(191) NOT NULL,
    `type`         VARCHAR(120) NULL,
    `processed_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Voting / token configuration (single-row settings) --------------------------
CREATE TABLE `mixed_settings` (
    `id`                       TINYINT      NOT NULL DEFAULT 1,
    `vote_duration_seconds`    INT          NOT NULL DEFAULT 60,
    `vote_options_count`       INT          NOT NULL DEFAULT 4,
    `map_cooldown_minutes`     INT          NOT NULL DEFAULT 120,
    `token_nominate_cost`      INT          NOT NULL DEFAULT 1,
    `token_set_next_cost`      INT          NOT NULL DEFAULT 5,
    `token_sponsor_cost`       INT          NOT NULL DEFAULT 3,
    `token_boost_weight`       INT          NOT NULL DEFAULT 3,
    `player_cooldown_minutes`  INT          NOT NULL DEFAULT 10,
    `allow_web_voting`         TINYINT(1)   NOT NULL DEFAULT 1,
    `public_feedback_enabled`  TINYINT(1)   NOT NULL DEFAULT 1,
    `updated_at`               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `mixed_settings` (`id`) VALUES (1);
