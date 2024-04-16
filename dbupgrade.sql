use zanderdev;

CREATE TABLE userVerifyLink (
	verifyId INT NOT NULL AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    username TEXT NOT NULL,
    linkCode VARCHAR(6),
    codeExpiry DATETIME NOT NULL,
    PRIMARY KEY (verifyId)
);

ALTER TABLE servers
ADD serverType ENUM('INTERNAL', 'EXTERNAL', 'VERIFICATION');

ALTER TABLE users
ADD discordId VARCHAR(18),
ADD account_registered DATETIME,
ADD social_aboutMe MEDIUMTEXT,
ADD social_interests VARCHAR(50),
ADD social_discord VARCHAR(32),
ADD social_steam VARCHAR(100),
ADD social_twitch VARCHAR(25),
ADD social_youtube VARCHAR(100),
ADD social_twitter_x VARCHAR(15),
ADD social_instagram VARCHAR(30),
ADD social_reddit VARCHAR(38),
ADD social_spotify VARCHAR(100),
ADD audit_lastDiscordPunishment DATETIME,
CHANGE email profilePicture_email VARCHAR(70),
CHANGE disabled account_disabled BOOLEAN DEFAULT 0;
