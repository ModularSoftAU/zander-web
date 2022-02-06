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

CREATE TABLE ranks (
	rankId INT NOT NULL AUTO_INCREMENT,
    rankSlug VARCHAR(15) UNIQUE NOT NULL,
    displayName VARCHAR(30),
    priority INT NOT NULL DEFAULT 900,
    rankBadgeColour VARCHAR(7) NOT NULL DEFAULT '#cd00cd',
    rankTextColour VARCHAR(7) NOT NULL DEFAULT '#000000',
    discordRoleId INT,
    isStaff BOOLEAN DEFAULT 0,
    isDonator BOOLEAN DEFAULT 0,
    PRIMARY KEY (rankId),
    INDEX ranks_isStaff (isStaff),
    INDEX ranks_isDonator (isDonator)
);

CREATE TABLE userRanks (
	userId INT NOT NULL,
    rankId INT NOT NULL,
    title TEXT,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (userId, rankId),
    CONSTRAINT userRanks_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT userRanks_rankId FOREIGN KEY (rankId) REFERENCES ranks (rankId) ON DELETE CASCADE
);

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
    uuid VARCHAR(36) NOT NULL,
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

CREATE TABLE voteSites (
	voteSiteId INT NOT NULL AUTO_INCREMENT,
    serverId INT NOT NULL,
    name VARCHAR(30),
    siteUrl TEXT,
    PRIMARY KEY (voteSiteId),
    CONSTRAINT voteSites_serverId FOREIGN KEY (serverId) REFERENCES servers (serverId) ON DELETE CASCADE
);

CREATE TABLE votes (
	voteId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    voteSiteId INT NOT NULL,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (voteId),
    INDEX votes_createdDate (createdDate),
    CONSTRAINT votes_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT votes_voteSiteId FOREIGN KEY (voteSiteId) REFERENCES voteSites (voteSiteId) ON DELETE CASCADE
);

CREATE TABLE alerts (
	alertId INT NOT NULL AUTO_INCREMENT,
    alertSlug VARCHAR(30) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    body TEXT,
    motd BOOLEAN DEFAULT 0,
    motdFormat BOOLEAN DEFAULT 0,
    tips BOOLEAN DEFAULT 0,
    web BOOLEAN DEFAULT 0,
    alertIcon VARCHAR(20),
    link TEXT,
    popUp BOOLEAN DEFAULT 0,
    createdDate DATETIME NOT NULL DEFAULT NOW(),
    updatedDate DATETIME,
    PRIMARY KEY (alertId)
);

-- Update the alerts.updatedDate when record is updated
CREATE TRIGGER alerts_updatedDateBeforeUpdate
BEFORE UPDATE ON alerts FOR EACH ROW
	SET NEW.updatedDate = NOW()
;

CREATE TABLE userAlerts (
	userAlertId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    body TEXT,
    link TEXT,
    PRIMARY KEY (userAlertId),
    CONSTRAINT userAlerts_userId FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
);

CREATE TABLE applications (
	applicationId INT NOT NULL AUTO_INCREMENT,
    displayName VARCHAR(30),
    description TEXT,
    displayIcon VARCHAR(20),
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
