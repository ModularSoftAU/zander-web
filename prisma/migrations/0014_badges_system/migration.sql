-- Badge System: badge definitions and user-badge ownership.

CREATE TABLE `badges` (
  `badgeId`         INT            NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(100)   NOT NULL,
  `description`     TEXT           NULL,
  `iconUrl`         VARCHAR(512)   NULL,
  `backgroundColor` VARCHAR(7)     NOT NULL DEFAULT '#1a1a2e',
  `luckpermsGroup`  VARCHAR(100)   NULL,
  `createdAt`       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)    NOT NULL,
  PRIMARY KEY (`badgeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `userBadges` (
  `userBadgeId` INT         NOT NULL AUTO_INCREMENT,
  `userId`      INT         NOT NULL,
  `badgeId`     INT         NOT NULL,
  `earnedAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `isManual`    TINYINT     NOT NULL DEFAULT 1,
  PRIMARY KEY (`userBadgeId`),
  UNIQUE INDEX `userBadges_userId_badgeId_key` (`userId`, `badgeId`),
  INDEX `userBadges_userId_idx` (`userId`),
  CONSTRAINT `userBadges_badgeId_fkey`
    FOREIGN KEY (`badgeId`) REFERENCES `badges` (`badgeId`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
