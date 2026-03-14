-- Add Watch feature tables
-- Migration: v1.15.0 -> v1.16.0
--
-- Creates the three tables required by the Watch feature:
--   user_platform_connections  - OAuth-linked Twitch/YouTube accounts per user
--   creator_content_items      - Streams and videos surfaced on /watch
--   creator_content_notifications - Deduplication log for Discord notifications

CREATE TABLE IF NOT EXISTS user_platform_connections (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id                 INT             NOT NULL,
  platform                VARCHAR(32)     NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  platform_account_id     VARCHAR(128)    NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  platform_channel_id     VARCHAR(128)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  platform_username       VARCHAR(128)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  platform_display_name   VARCHAR(128)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  avatar_url              VARCHAR(512)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  access_token            TEXT            DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  refresh_token           TEXT            DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  token_expires_at        DATETIME        DEFAULT NULL,
  is_active               TINYINT(1)      NOT NULL DEFAULT 1,
  last_successful_sync_at DATETIME        DEFAULT NULL,
  last_sync_error         VARCHAR(255)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_platform (user_id, platform),
  KEY idx_platform_active (platform, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_content_items (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id             INT             NOT NULL,
  platform            VARCHAR(32)     NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  external_content_id VARCHAR(128)    NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  external_channel_id VARCHAR(128)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  content_type        VARCHAR(32)     NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  title               VARCHAR(512)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  description         TEXT            DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  thumbnail_url       VARCHAR(512)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  watch_url           VARCHAR(512)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  viewer_count        INT UNSIGNED    DEFAULT NULL,
  tags_json           TEXT            DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  is_live             TINYINT(1)      NOT NULL DEFAULT 0,
  published_at        DATETIME        DEFAULT NULL,
  started_at          DATETIME        DEFAULT NULL,
  ended_at            DATETIME        DEFAULT NULL,
  matched_rule        VARCHAR(128)    DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  is_cfc_related      TINYINT(1)      NOT NULL DEFAULT 0,
  is_publicly_visible TINYINT(1)      NOT NULL DEFAULT 0,
  last_seen_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_platform_content (platform, external_content_id),
  KEY idx_public_live    (is_publicly_visible, is_live),
  KEY idx_public_video   (is_publicly_visible, content_type, is_live),
  KEY idx_user_platform  (user_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_content_notifications (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  platform            VARCHAR(32)     NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  external_content_id VARCHAR(128)    NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  notification_type   VARCHAR(64)     NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  discord_message_id  VARCHAR(32)     DEFAULT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification (platform, external_content_id, notification_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
