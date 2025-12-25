ALTER TABLE announcements
  MODIFY COLUMN announcementType ENUM('motd', 'tip', 'web', 'popup'),
  ADD COLUMN popupButtonText VARCHAR(60) NULL,
  ADD COLUMN popupImageUrl TEXT NULL,
  ADD COLUMN startDate DATETIME NULL,
  ADD COLUMN endDate DATETIME NULL;

CREATE TABLE scheduledDiscordMessages (
    scheduleId INT NOT NULL AUTO_INCREMENT,
    channelId VARCHAR(50) NOT NULL,
    embedTitle VARCHAR(255),
    embedDescription TEXT,
    embedColor VARCHAR(20),
    scheduledFor DATETIME NOT NULL,
    createdBy INT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    sentAt DATETIME,
    status ENUM('scheduled', 'sent', 'failed') DEFAULT 'scheduled',
    lastError TEXT,
    PRIMARY KEY (scheduleId),
    INDEX scheduledDiscordMessages_scheduledFor (scheduledFor),
    INDEX scheduledDiscordMessages_status (status)
);
