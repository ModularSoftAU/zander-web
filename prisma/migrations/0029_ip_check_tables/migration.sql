-- prisma/migrations/0029_ip_check_tables/migration.sql
-- =============================================================================
-- Migration 0029: /ipcheck support tables
-- =============================================================================
-- player_ip_history is an aggregate view over gameSessions, upserted from
-- POST /api/session/create so /ipcheck doesn't need to scan gameSessions live.
-- ip_check_audit_log records every /ipcheck invocation for staff accountability.
-- =============================================================================

CREATE TABLE `player_ip_history` (
    `id`             INT           NOT NULL AUTO_INCREMENT,
    `uuid`           VARCHAR(36)   NOT NULL,
    `ip_address`     VARCHAR(45)   NOT NULL,
    `first_seen_at`  DATETIME      NOT NULL,
    `last_seen_at`   DATETIME      NOT NULL,
    `session_count`  INT           NOT NULL DEFAULT 0,
    `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `player_ip_history_uuid_ip_unique` (`uuid`, `ip_address`),
    KEY `player_ip_history_uuid_idx` (`uuid`),
    KEY `player_ip_history_ip_idx` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ip_check_audit_log` (
    `id`                       INT           NOT NULL AUTO_INCREMENT,
    `discord_user_id`          VARCHAR(32)   NOT NULL,
    `discord_tag`              VARCHAR(64)   NOT NULL,
    `permission_node_matched`  VARCHAR(128)  NULL,
    `query_type`               VARCHAR(16)   NOT NULL,
    `search_target`            VARCHAR(255)  NOT NULL,
    `result_count`             INT           NOT NULL DEFAULT 0,
    `success`                  TINYINT(1)    NOT NULL DEFAULT 0,
    `guild_id`                 VARCHAR(32)   NULL,
    `channel_id`               VARCHAR(32)   NULL,
    `created_at`               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ip_check_audit_log_discord_user_idx` (`discord_user_id`),
    KEY `ip_check_audit_log_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
