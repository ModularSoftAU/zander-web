DROP DATABASE IF EXISTS zanderDev;
CREATE DATABASE IF NOT EXISTS zanderDev;
USE zanderDev;

CREATE TABLE users (
	userId INT NOT NULL AUTO_INCREMENT,
	uuid VARCHAR(36) NOT NULL,
	username VARCHAR(16) UNIQUE,
	email VARCHAR(200),
	password TEXT,
	joined DATETIME NOT NULL DEFAULT NOW(),
	disabled BOOLEAN DEFAULT 0,
	interests TEXT,
	twitter VARCHAR(15),
	twitch TEXT,
	steam VARCHAR(32),
	github VARCHAR(40),
	spotify VARCHAR(30),
	discord TEXT,
	youtube TEXT,
	instagram VARCHAR(30),
	aboutPage TEXT,
	coverArt VARCHAR(54),
	PRIMARY KEY (userId),
	INDEX users (uuid(8))
);

INSERT INTO users (uuid, username, disabled)
VALUES ('f78a4d8d-d51b-4b39-98a3-230f2de0c670','CONSOLE',0);

CREATE VIEW zanderdev.luckPermsPlayers AS
SELECT * FROM cfcdev_luckperms.luckperms_players;

CREATE TABLE userSettings (
	userSettingsId INT NOT NULL AUTO_INCREMENT,
    userId INT,
    userKey TEXT,
    value TEXT,
    PRIMARY KEY (userSettingsId),
    CONSTRAINT userSettings_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE userStats (
	statId INT NOT NULL,
    userId INT NOT NULL,
    statName TEXT,
    statValue INT,
    PRIMARY KEY (statId, userId),
    INDEX userStats_statId (statId),
    CONSTRAINT userStats_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE userVerify (
    userVerifyId INT NOT NULL AUTO_INCREMENT,
    verificationToken VARCHAR(16) UNIQUE, 
    username VARCHAR(16),
    email VARCHAR(200),
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    verifiedOn DATETIME,
    verified BOOLEAN DEFAULT 0,
    PRIMARY KEY (userVerifyId)
);

-- Generate verificationToken before data is inserted if it NULL
CREATE TRIGGER userVerify_generateTokenBeforeInsert
BEFORE INSERT ON userVerify FOR EACH ROW
	SET NEW.verificationToken = LEFT(REPLACE(UUID(), '-', ''), 16)
;

-- Update verifiedOn to current date when verified is set to true (1)
CREATE TRIGGER userVerify_insertVerifiedDateAfterUpdate
BEFORE UPDATE ON userVerify FOR EACH ROW
	SET NEW.verifiedOn = CASE
		WHEN NEW.verified = 1 AND NEW.verifiedOn IS NULL THEN NOW()
        ELSE NEW.verifiedOn = NEW.verifiedOn
    END
;

CREATE VIEW zanderdev.ranks AS 
SELECT
	lpGroups.name AS rankSlug,
    COALESCE(SUBSTRING_INDEX(lpGroupDisplayName.permission ,'.', -1), lpGroups.name) AS displayName,
    SUBSTRING_INDEX(lpGroupWeight.permission, '.', -1) AS priority,
    -- Color codes puled from: https://minecraft.fandom.com/wiki/Formatting_codes
    CASE LEFT(SUBSTRING_INDEX(lpGroupPrefix.permission, '[&', -1), 1)
		WHEN '0' THEN '#000000'
        WHEN '1' THEN '#0000AA'
        WHEN '2' THEN '#00AA00'
        WHEN '3' THEN '#00AAAA'
        WHEN '4' THEN '#AA0000'
        WHEN '5' THEN '#AA00AA'
        WHEN '6' THEN '#FFAA00'
        WHEN '7' THEN '#AAAAAA'
        WHEN '8' THEN '#555555'
        WHEN '9' THEN '#5555FF'
        WHEN 'a' THEN '#55FF55'
        WHEN 'b' THEN '#55FFFF'
        WHEN 'c' THEN '#FF5555'
        WHEN 'd' THEN '#FF55FF'
        WHEN 'e' THEN '#FFFF55'
        WHEN 'g' THEN '#DDD605'
        ELSE '#FFFFFF'
	END AS rankBadgeColour,
        CASE WHEN 
			LEFT(SUBSTRING_INDEX(lpGroupPrefix.permission, '[&', -1), 1) IN ('0','1','2','3','4','5','8','9') THEN '#FFFFFF'
        ELSE '#000000'
	END AS rankTextColour,
    '' AS discordRoleId,
    COALESCE(RIGHT(lpGroupStaff.permission, 1),'0') AS isStaff,
    COALESCE(RIGHT(lpGroupDonator.permission, 1),'0') AS isDonator
FROM cfcdev_luckperms.luckperms_groups lpGroups
	LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupDisplayName ON lpGroups.name = lpGroupDisplayName.name
		AND lpGroupDisplayName.permission LIKE 'displayname.%'
        AND lpGroupDisplayName.value = 1
	LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupWeight ON lpGroups.name = lpGroupWeight.name
		AND lpGroupWeight.permission LIKE 'weight.%'
        AND lpGroupWeight.value = 1
	LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupPrefix ON lpGroups.name = lpGroupPrefix.name
		AND lpGroupPrefix.permission LIKE 'prefix.%'
        AND lpGroupPrefix.value = 1
	LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupStaff On lpGroups.name = lpGroupStaff.name
		AND lpGroupStaff.permission LIKE 'meta.staff.%'
        AND lpGroupStaff.value = 1
	LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupDonator On lpGroups.name = lpGroupDonator.name
		AND lpGroupDonator.permission LIKE 'meta.donator.%'
        AND lpGroupDonator.value = 1;

CREATE VIEW zanderdev.userRanks AS
SELECT
	zdUsers.userId,
	lpUserPermissions.uuid,
	SUBSTRING_INDEX(lpUserPermissions.permission ,'.', -1) AS rankSlug,
    SUBSTRING_INDEX(lpUserTitle.permission, 'title.', -1) AS title
FROM cfcdev_luckperms.luckperms_user_permissions lpUserPermissions
	LEFT JOIN cfcdev_luckperms.luckperms_user_permissions lpUserTitle On lpUserPermissions.uuid = lpUserTitle.uuid
		AND lpUserTitle.permission LIKE CONCAT('meta.group\\\\.',SUBSTRING_INDEX(lpUserPermissions.permission ,'.', -1),'\\\\.title.%')
        AND lpUserTitle.value = 1
	LEFT JOIN zanderdev.users zdUsers ON lpUserPermissions.uuid = zdUsers.uuid
WHERE lpUserPermissions.permission like 'group.%'
	AND lpUserPermissions.value = 1;

CREATE VIEW zanderdev.userPermissions AS
SELECT
    u.uuid,
    u.userId,
	up.permission,
	up.value,
    up.server,
    up.world,
    up.expiry,
    up.contexts,
	u.username
FROM  cfcdev_luckperms.luckperms_user_permissions up
RIGHT JOIN zanderdev.users u ON up.uuid = u.uuid
WHERE up.permission IS NOT NULL
	AND up.permission NOT LIKE 'group.%'
    AND up.value = 1;

CREATE VIEW zanderdev.rankPermissions AS
SELECT
	name AS rankSlug,
    permission,
    value,
    server,
    world,
    expiry,
    contexts
FROM cfcdev_luckperms.luckperms_group_permissions gp
WHERE gp.permission IS NOT NULL
	AND gp.permission NOT LIKE 'group.%'
    AND gp.value = 1;

CREATE TABLE servers (
	serverId INT NOT NULL AUTO_INCREMENT,
    name TEXT,
    fqdn VARCHAR(50),
    ipAddress VARCHAR(15),
    port SMALLINT,
    visible BOOLEAN DEFAULT 0,
    position INT,
    PRIMARY KEY (serverId),
    INDEX servers_visible (visible)
);

CREATE TABLE gameSessions (
	sessionId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    sessionStart DATETIME NOT NULL DEFAULT NOW(),
    sessionEnd DATETIME,
    ipAddress VARCHAR(45),
    serverId INT NOT NULL,
    PRIMARY KEY (sessionId),
    INDEX gameSessions_sessionStart (sessionStart),
    INDEX gameSessions_sessionEnd (sessionEnd),
    CONSTRAINT gameSessions_serverId FOREIGN KEY (serverId) REFERENCES servers (serverId) ON DELETE CASCADE
);

CREATE TABLE friends (
	userId INT NOT NULL,
    friendId INT NOT NULL,
    accepted BOOLEAN DEFAULT 0,
    pending BOOLEAN DEFAULT 0,
    blocked BOOLEAN DEFAULT 0,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (userId, friendId),
    INDEX friends_accepted (accepted),
    CONSTRAINT friends_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT friends_friendId FOREIGN KEY (friendId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE reports (
	reportId INT NOT NULL AUTO_INCREMENT,
    reportedUserId INT NOT NULL,
    reporterUserId INT NOT NULL,
    reason TEXT,
    evidence TEXT,
    platform TEXT,
    server INT NOT NULL,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    closed BOOLEAN DEFAULT 0,
    PRIMARY KEY (reportId),
    INDEX reports_createdDate (createdDate),
    INDEX reports_closed (closed),
    CONSTRAINT reports_server FOREIGN KEY (server) REFERENCES servers (serverId),
    CONSTRAINT reports_reportedUserId FOREIGN KEY (reportedUserId) REFERENCES users (userId) ON DELETE RESTRICT,
    CONSTRAINT reports_reporterUserId FOREIGN KEY (reporterUserId) REFERENCES users (userId) ON DELETE RESTRICT
);

CREATE TABLE events (
	eventId INT NOT NULL AUTO_INCREMENT,
    name TEXT,
    icon TEXT,
    eventDateTime DATETIME,
    hostingServer INT NOT NULL,
    information TEXT,
    guildEventId VARCHAR(18),
    guildEventChannel VARCHAR(18),
    published BOOLEAN DEFAULT 0,
    PRIMARY KEY (eventId),
    INDEX events_eventDateTime (eventDateTime),
    INDEX events_published (published),
    CONSTRAINT events_hostingServer FOREIGN KEY (hostingServer) REFERENCES servers (serverId) ON DELETE CASCADE
);

CREATE TABLE punishments (
	punishmentId INT NOT NULL AUTO_INCREMENT,
    playerId INT NOT NULL,
    staffId INT NOT NULL,
    platform VARCHAR(10),
    type VARCHAR(20),
    reason VARCHAR(50),
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    expires DATETIME,
    appealed BOOLEAN DEFAULT 0,
    PRIMARY KEY (punishmentId),
    INDEX punishments_createdDate (createdDate),
    INDEX punishments_expires (expires),
    CONSTRAINT punishments_playerId FOREIGN KEY (playerId) REFERENCES users (userId) ON DELETE RESTRICT,
    CONSTRAINT punishments_staffId FOREIGN KEY (staffId) REFERENCES users (userId) ON DELETE RESTRICT
);

CREATE TABLE ipBans (
	ipBanId INT NOT NULL AUTO_INCREMENT,
    staffId INT NOT NULL,
    punishmentId INT,
    ipAddress TEXT,
    reason VARCHAR(50),
    enabled BOOLEAN DEFAULT 1,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ipBanId),
    INDEX ipBans_ipAddress (ipAddress(7))
);

CREATE TABLE ipBanUserExclusions (
	ipBanId INT NOT NULL,
    userId INT NOT NULL,
    PRIMARY KEY (ipBanId, userId),
    CONSTRAINT ipBanUserExclusions_ipBanId FOREIGN KEY (ipBanId) REFERENCES ipBans (ipBanId) ON DELETE CASCADE,
    CONSTRAINT ipBanUserExclusion_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE appeals (
	appealId INT NOT NULL AUTO_INCREMENT,
    punishmentId INT NOT NULL,
    playerId INT NOT NULL,
    closed BOOLEAN DEFAULT 0,
    escalated BOOLEAN DEFAULT 0,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    updatedDate DATETIME,
    PRIMARY KEY (appealId),
    INDEX appeals_createdDate (createdDate),
    CONSTRAINT appeals_punishmentId FOREIGN KEY (punishmentId) REFERENCES punishments (punishmentId) ON DELETE CASCADE,
    CONSTRAINT appeals_playerId FOREIGN KEY (playerId) REFERENCES users (userId) ON DELETE CASCADE
);

-- Update the appeals.updatedDate when record is updated
CREATE TRIGGER appeals_updatedDateBeforeUpdate
BEFORE UPDATE ON appeals FOR EACH ROW
	SET NEW.updatedDate = NOW()
;

CREATE TABLE appealActions (
	appealActionId INT NOT NULL AUTO_INCREMENT,
    appealId INT NOT NULL,
    staffId INT NOT NULL,
    action TEXT,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    updatedDate DATETIME,
    PRIMARY KEY (appealActionId),
    INDEX appealActions_createdDate (createdDate),
    CONSTRAINT appealActions_appealId FOREIGN KEY (appealId) REFERENCES appeals (appealId) ON DELETE CASCADE,
    CONSTRAINT appealActions_staffId FOREIGN KEY (staffId) REFERENCES users (userId) ON DELETE CASCADE
);

-- Update the appealActions.updatedDate when record is updated
CREATE TRIGGER appealActions_updatedDateBeforeUpdate
BEFORE UPDATE ON appealActions FOR EACH ROW
	SET NEW.updatedDate = NOW()
;

CREATE TABLE appealComments (
	appealCommentId INT NOT NULL AUTO_INCREMENT,
    appealId INT NOT NULL,
    userId INT NOT NULL,
    staffNote BOOLEAN DEFAULT 0,
    initialComment BOOLEAN DEFAULT 0,
    content TEXT,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    updatedDate DATETIME,
    PRIMARY KEY (appealCommentId),
    INDEX appealComments_createdDate (createdDate),
    INDEX appealComments_staffNote (staffNote),
    CONSTRAINT appealComments_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT appealComments_appealId FOREIGN KEY (appealId) REFERENCES appeals (appealId) ON DELETE CASCADE
);

-- Update the appealComments.updatedDate when record is updated
CREATE TRIGGER appealComments_updatedDateBeforeUpdate
BEFORE UPDATE ON appealComments FOR EACH ROW
	SET NEW.updatedDate = NOW()
;

CREATE TABLE anticheat (
	anticheatId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    type TEXT,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (anticheatId),
    CONSTRAINT antichat_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE RESTRICT
);

-- CREATE TABLE voteSites (
-- 	voteSiteId INT NOT NULL AUTO_INCREMENT,
--     serverId INT NOT NULL,
--     name VARCHAR(30),
--     siteUrl TEXT,
--     PRIMARY KEY (voteSiteId),
--     CONSTRAINT voteSites_serverId FOREIGN KEY (serverId) REFERENCES servers (serverId) ON DELETE CASCADE
-- );

CREATE TABLE votes (
	voteId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    voteSite VARCHAR(50),
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (voteId),
    INDEX votes_createdDate (createdDate),
    CONSTRAINT votes_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE announcements (
	announcementId INT NOT NULL AUTO_INCREMENT,
    announcementSlug VARCHAR(30) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    body TEXT,
    motd BOOLEAN DEFAULT 0,
    motdFormat BOOLEAN DEFAULT 0,
    tips BOOLEAN DEFAULT 0,
    web BOOLEAN DEFAULT 0,
    link TEXT,
    popUp BOOLEAN DEFAULT 0,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    updatedDate DATETIME,
    PRIMARY KEY (announcementId)
);

-- Update the announcements.updatedDate when record is updated
CREATE TRIGGER announcements_updatedDateBeforeUpdate
BEFORE UPDATE ON announcements FOR EACH ROW
	SET NEW.updatedDate = NOW()
;

CREATE TABLE notifications (
	notificationId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    icon TEXT,
    body TEXT,
    link TEXT,
    PRIMARY KEY (notificationId),
    CONSTRAINT notifications_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE applications (
	applicationId INT NOT NULL AUTO_INCREMENT,
    displayName VARCHAR(30),
    description TEXT,
    displayIcon VARCHAR(40),
    requirementsMarkdown TEXT,
    redirectUrl TEXT,
    position INT,
    closed BOOLEAN DEFAULT 0,
    PRIMARY KEY (applicationId),
    INDEX applications_closed (closed)
);

CREATE TABLE knowledgebaseSections (
	sectionId INT NOT NULL AUTO_INCREMENT,
    sectionSlug VARCHAR(30) UNIQUE NOT NULL,
    sectionName VARCHAR(30),
    description TEXT,
    sectionIcon VARCHAR(30),
    position INT,
    PRIMARY KEY (sectionId)
);

CREATE TABLE knowledgebaseArticles (
	articleId INT NOT NULL AUTO_INCREMENT,
    sectionId INT NOT NULL,
    articleSlug VARCHAR(30) UNIQUE NOT NULL,
    articleName VARCHAR(30),
    articleDescription TEXT,
    articleLink TEXT,
    position INT,
    published BOOLEAN DEFAULT 1,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (articleId),
    INDEX knowledgebaseArticles_published (published),
    CONSTRAINT knowledgebaseArticles_sectionId FOREIGN KEY (sectionId) REFERENCES knowledgebaseSections (sectionId) ON DELETE RESTRICT
);

CREATE TABLE minecraftItems (
	`name` VARCHAR(70),
    idName VARCHAR(50),
    id INT NOT NULL,
    dataValue INT NOT NULL,
    imagePath VARCHAR(81),
    PRIMARY KEY (id, dataValue),
    INDEX minecraftItems_idName (idName)
);

CREATE TABLE shops (
	shopId INT NOT NULL AUTO_INCREMENT,
    shopCreatorId INT NOT NULL,
    shopName VARCHAR(30),
    shopDescription TEXT,
    serverId INT NOT NULL,
    PRIMARY KEY (shopId),
    CONSTRAINT shops_shopCreatorId FOREIGN KEY (shopCreatorId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT shops_serverId FOREIGN KEY (serverId) REFERENCES servers (serverId) ON DELETE CASCADE
);

CREATE TABLE shopItems (
	shopItemId INT NOT NULL AUTO_INCREMENT,
    shopId INT NOT NULL,
    shopItem VARCHAR(50),
    shopPrice DECIMAL(5,2),
    shopBuyQuantity INT,
    PRIMARY KEY (shopItemId),
    INDEX shopItems_shopPrice (shopPrice),
    CONSTRAINT shopItems_shopId FOREIGN KEY (shopId) REFERENCES shops (shopId) ON DELETE CASCADE,
    CONSTRAINT shopItems_shopItem FOREIGN KEY (shopItem) REFERENCES minecraftItems (idName) ON UPDATE CASCADE
);

CREATE TABLE communityCreations (
	creationId INT NOT NULL AUTO_INCREMENT,
    creatorId INT NOT NULL,
    creationName VARCHAR(30),
    creationDescription TEXT,
    approved BOOLEAN DEFAULT 0,
    submittedDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (creationId),
    INDEX communityCreations_submittedDate (submittedDate),
    INDEX communityCreations_approved (approved),
    CONSTRAINT communityCreations_creatorId FOREIGN KEY (creatorId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE communityCreationImages (
	creationImageId INT NOT NULL AUTO_INCREMENT,
    creationId INT NOT NULL,
    imageLink TEXT,
    cover BOOLEAN DEFAULT 0,
	approved BOOLEAN DEFAULT 0,
    position INT,
    PRIMARY KEY (creationImageId),
    INDEX communityCreationImages_cover (cover),
    CONSTRAINT communityCreationImages_creationId FOREIGN KEY (creationid) REFERENCES communityCreations (creationId) ON DELETE CASCADE
);

-- Trigger to automatically add the position column for newly inserted images of a community creatin.
CREATE TRIGGER communityCreationImages_positionBeforeInsert
BEFORE INSERT ON communityCreationImages FOR EACH ROW
	SET NEW.position = (SELECT COUNT(*) FROM communityCreationImages WHERE creationId = NEW.creationId) + 1
;

CREATE TABLE communityLikes (
	creationId INT NOT NULL,
    userId INT NOT NULL,
    PRIMARY KEY (creationid, userId),
    CONSTRAINT communityLikes_creationId FOREIGN KEY (creationId) REFERENCES communityCreations (creationId) ON DELETE CASCADE,
    CONSTRAINT communityLikes_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);