-- Migration: v1.20.0 -> v1.21.0
-- Adds eligibility rules system for application forms.

-- Stores per-application eligibility rule configuration.
CREATE TABLE IF NOT EXISTS application_eligibility_rules (
    id                          INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_form_id         INT             NOT NULL UNIQUE,
    minimum_playtime_hours      INT             DEFAULT NULL,
    block_if_currently_banned   TINYINT(1)      NOT NULL DEFAULT 0,
    block_if_ever_banned        TINYINT(1)      NOT NULL DEFAULT 0,
    punishment_lookback_months  INT             DEFAULT NULL,
    max_punishments_in_lookback INT             DEFAULT NULL,
    block_if_banned_on_any_platform TINYINT(1)  NOT NULL DEFAULT 0,
    require_discord_activity    TINYINT(1)      NOT NULL DEFAULT 0,
    discord_activity_lookback_days  INT         DEFAULT NULL,
    minimum_discord_messages    INT             DEFAULT NULL,
    created_at                  DATETIME        NOT NULL DEFAULT NOW(),
    updated_at                  DATETIME        NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_aer_form (application_form_id)
);

-- Snapshot of eligibility state at the time a form response is submitted.
CREATE TABLE IF NOT EXISTS application_eligibility_snapshots (
    id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    form_response_id        INT             NOT NULL,
    application_form_id     INT             NOT NULL,
    user_id                 INT             NOT NULL,
    eligible                TINYINT(1)      NOT NULL,
    failed_rules            JSON            DEFAULT NULL,
    playtime_hours          DECIMAL(10,2)   DEFAULT NULL,
    currently_banned        TINYINT(1)      DEFAULT NULL,
    ever_banned             TINYINT(1)      DEFAULT NULL,
    punishments_in_lookback INT             DEFAULT NULL,
    platform_ban_sources    JSON            DEFAULT NULL,
    discord_message_count   INT             DEFAULT NULL,
    override_by_user_id     INT             DEFAULT NULL,
    created_at              DATETIME        NOT NULL DEFAULT NOW(),
    INDEX idx_aes_response (form_response_id),
    INDEX idx_aes_user (user_id)
);

-- Audit log for staff eligibility overrides.
CREATE TABLE IF NOT EXISTS application_eligibility_overrides (
    id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staff_user_id           INT             NOT NULL,
    applicant_user_id       INT             NOT NULL,
    application_form_id     INT             NOT NULL,
    failed_rules            JSON            NOT NULL,
    created_at              DATETIME        NOT NULL DEFAULT NOW(),
    INDEX idx_aeo_staff (staff_user_id),
    INDEX idx_aeo_applicant (applicant_user_id)
);

-- Tracks Discord message/interaction events for eligibility activity checks.
CREATE TABLE IF NOT EXISTS discord_activity_log (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    discord_user_id VARCHAR(24)     DEFAULT NULL,
    channel_id      VARCHAR(24)     DEFAULT NULL,
    activity_type   ENUM('message', 'reaction', 'voice') NOT NULL DEFAULT 'message',
    occurred_at     DATETIME        NOT NULL DEFAULT NOW(),
    INDEX idx_dal_user (user_id),
    INDEX idx_dal_discord (discord_user_id),
    INDEX idx_dal_occurred (occurred_at)
);
