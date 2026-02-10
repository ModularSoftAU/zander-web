-- Discord Punishments System
-- Migration: v1.9.0 -> v1.10.0

CREATE TABLE IF NOT EXISTS discord_punishments (
    id INT NOT NULL AUTO_INCREMENT,
    type ENUM('WARN', 'DISCORD_KICK', 'TEMP_BAN', 'PERM_BAN', 'TEMP_MUTE', 'PERM_MUTE') NOT NULL,
    platform VARCHAR(16) NOT NULL DEFAULT 'DISCORD',
    target_discord_user_id VARCHAR(24) NOT NULL,
    target_discord_tag VARCHAR(100),
    target_player_id INT DEFAULT NULL,
    actor_discord_user_id VARCHAR(24) NOT NULL,
    actor_name_snapshot VARCHAR(100),
    reason TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    expires_at DATETIME DEFAULT NULL,
    lifted_at DATETIME DEFAULT NULL,
    status ENUM('ACTIVE', 'EXPIRED', 'LIFTED', 'APPEALED', 'APPEAL_PENDING', 'APPEAL_REJECTED') NOT NULL DEFAULT 'ACTIVE',
    appeal_id INT DEFAULT NULL,
    context JSON DEFAULT NULL,
    dm_status ENUM('SENT', 'FAILED_CLOSED_DMS', 'FAILED_UNKNOWN', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_APPLICABLE',
    PRIMARY KEY (id),
    INDEX idx_discord_punishments_target (target_discord_user_id),
    INDEX idx_discord_punishments_status (status),
    INDEX idx_discord_punishments_type (type),
    INDEX idx_discord_punishments_expires (status, expires_at),
    INDEX idx_discord_punishments_player (target_player_id)
);

CREATE TABLE IF NOT EXISTS discord_punishment_appeals (
    id INT NOT NULL AUTO_INCREMENT,
    punishment_id INT NOT NULL,
    discord_user_id VARCHAR(24) NOT NULL,
    appeal_reason TEXT NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    reviewer_discord_user_id VARCHAR(24) DEFAULT NULL,
    reviewer_notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    reviewed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    INDEX idx_appeals_punishment (punishment_id),
    INDEX idx_appeals_user (discord_user_id),
    INDEX idx_appeals_status (status),
    CONSTRAINT fk_appeals_punishment FOREIGN KEY (punishment_id) REFERENCES discord_punishments(id) ON DELETE CASCADE
);
