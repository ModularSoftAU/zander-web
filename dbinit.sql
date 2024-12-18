DROP DATABASE IF EXISTS zanderdev;
CREATE DATABASE IF NOT EXISTS zanderdev;
USE zanderdev;

CREATE TABLE users (
	userId INT NOT NULL AUTO_INCREMENT,
	uuid VARCHAR(36) NOT NULL UNIQUE,
	username VARCHAR(16) NOT NULL,
    discordId VARCHAR(18),
	joined DATETIME NOT NULL DEFAULT NOW(),
    profilePicture_type ENUM('CRAFTATAR', 'GRAVATAR') DEFAULT 'CRAFTATAR',
    profilePicture_email VARCHAR(70),
    account_registered DATETIME,
	account_disabled BOOLEAN DEFAULT 0,
    social_aboutMe MEDIUMTEXT,
    social_interests VARCHAR(50),
    social_discord VARCHAR(32),
    social_steam VARCHAR(100),
    social_twitch VARCHAR(25),
    social_youtube VARCHAR(100),
    social_twitter_x VARCHAR(15),
    social_instagram VARCHAR(30),
    social_reddit VARCHAR(38),
    social_spotify VARCHAR(100),
	audit_lastDiscordMessage DATETIME,
	audit_lastDiscordVoice DATETIME,
	audit_lastMinecraftLogin DATETIME,
	audit_lastMinecraftMessage DATETIME,
	audit_lastMinecraftPunishment DATETIME,
	audit_lastDiscordPunishment DATETIME,
	audit_lastWebsiteLogin DATETIME,
	PRIMARY KEY (userId),
	INDEX users (uuid(8))
);

CREATE TABLE userVerifyLink (
	verifyId INT NOT NULL AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    username TEXT NOT NULL,
    linkCode VARCHAR(6),
    codeExpiry DATETIME NOT NULL,
    PRIMARY KEY (verifyId)
);

INSERT INTO users (uuid, username, account_disabled)
VALUES ('f78a4d8d-d51b-4b39-98a3-230f2de0c670','CONSOLE',0);

CREATE VIEW zanderdev.luckPermsPlayers AS
SELECT * FROM cfcdev_luckperms.luckperms_players;

CREATE VIEW zanderdev.ranks AS 
SELECT
    lpGroups.name AS rankSlug,
    COALESCE(SUBSTRING_INDEX(lpGroupDisplayName.permission, '.', -1), lpGroups.name) AS displayName,
    SUBSTRING_INDEX(lpGroupWeight.permission, '.', -1) AS priority,
    CONCAT('#', COALESCE(RIGHT(lpGroupBadgeColour.permission, 6), 'FFFFFF')) AS rankBadgeColour,
    CONCAT('#', COALESCE(RIGHT(lpGroupTextColour.permission, 6), '000000')) AS rankTextColour,
    COALESCE(SUBSTRING_INDEX(lpDiscordId.permission, '.', -1), null) AS discordRoleId,
    COALESCE(RIGHT(lpGroupStaff.permission, 1), '0') AS isStaff,
    COALESCE(RIGHT(lpGroupDonator.permission, 1), '0') AS isDonator
FROM cfcdev_luckperms.luckperms_groups lpGroups
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupDisplayName ON lpGroups.name = lpGroupDisplayName.name
    AND lpGroupDisplayName.permission LIKE 'displayname.%'
    AND lpGroupDisplayName.value = 1
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupWeight ON lpGroups.name = lpGroupWeight.name
    AND lpGroupWeight.permission LIKE 'weight.%'
    AND lpGroupWeight.value = 1
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupBadgeColour ON lpGroups.name = lpGroupBadgeColour.name
    AND LOWER(lpGroupBadgeColour.permission) LIKE 'meta.rankbadgecolour.%'
    AND lpGroupBadgeColour.value = 1
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupTextColour ON lpGroups.name = lpGroupTextColour.name
    AND LOWER(lpGroupTextColour.permission) LIKE 'meta.ranktextcolour.%'
    AND lpGroupTextColour.value = 1
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupStaff ON lpGroups.name = lpGroupStaff.name
    AND lpGroupStaff.permission LIKE 'meta.staff.%'
    AND lpGroupStaff.value = 1
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpGroupDonator ON lpGroups.name = lpGroupDonator.name
    AND lpGroupDonator.permission LIKE 'meta.donator.%'
    AND lpGroupDonator.value = 1
    LEFT JOIN cfcdev_luckperms.luckperms_group_permissions lpDiscordId ON lpGroups.name = lpDiscordId.name
    AND lpDiscordId.permission LIKE 'meta.discordid.%'
    AND lpDiscordId.value = 1
WHERE lpGroups.name NOT LIKE '%griefdefender%'
  AND lpGroups.name NOT LIKE '%default%';

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
	AND lpUserPermissions.value = 1
    AND SUBSTRING_INDEX(lpUserPermissions.permission, '.', -1) != 'default';

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

CREATE VIEW zanderdev.rankRanks AS
SELECT
	gp.name AS parentRankSlug,
    SUBSTRING_INDEX(gp.permission, '.', -1) AS rankSlug
FROM cfcdev_luckperms.luckperms_group_permissions gp
WHERE gp.permission IS NOT NULL
	AND gp.permission LIKE 'group.%'
    AND gp.value = 1;

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
    displayName TEXT,
    serverConnectionAddress TEXT,
    serverType ENUM('INTERNAL', 'EXTERNAL', 'VERIFICATION'),
    position INT,
    PRIMARY KEY (serverId)
);

CREATE TABLE gameSessions (
	sessionId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    sessionStart DATETIME NOT NULL DEFAULT NOW(),
    sessionEnd DATETIME,
    ipAddress VARCHAR(45),
    server TEXT,
    PRIMARY KEY (sessionId),
    INDEX gameSessions_sessionStart (sessionStart),
    INDEX gameSessions_sessionEnd (sessionEnd)
);

CREATE TABLE announcements (
	announcementId INT NOT NULL AUTO_INCREMENT,
    enabled BOOLEAN DEFAULT 1,
    announcementType ENUM('motd', 'tip', 'web'),
    body TEXT,
    colourMessageFormat TEXT,
    link TEXT,
    updatedDate DATETIME,
    PRIMARY KEY (announcementId)
);

-- Update the announcements.updatedDate when record is updated
CREATE TRIGGER announcements_updatedDateBeforeUpdate
BEFORE UPDATE ON announcements FOR EACH ROW
	SET NEW.updatedDate = NOW()
;

CREATE TABLE applications (
	applicationId INT NOT NULL AUTO_INCREMENT,
    displayName VARCHAR(30),
    description TEXT,
    displayIcon VARCHAR(40),
    requirementsMarkdown TEXT,
    redirectUrl TEXT,
    position INT,
    applicationStatus BOOLEAN DEFAULT 0,
    PRIMARY KEY (applicationId)
);

CREATE TABLE reports (
	reportId INT NOT NULL AUTO_INCREMENT,
    reporterId INT NOT NULL,
    reportedUser VARCHAR(30) NOT NULL,
    reportReason VARCHAR(100) NOT NULL,
    reportReasonEvidence MEDIUMTEXT,
    reportPlatform VARCHAR(10) NOT NULL,
    reportDateTime DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (reportId)
);

CREATE VIEW shoppingDirectory AS
SELECT
    shops.id,
    users.uuid,
    users.userId,
    substring_index(
        SUBSTRING(item,
            LOCATE('type:', item) + LENGTH('type:')
        ),
        '\n',
        1
    ) AS item,
    CASE LOCATE('amount:', item)
        WHEN 0 THEN null
        ELSE substring_index(
            SUBSTRING(item,
                LOCATE('amount:', item) + LENGTH('amount:')
            ),
            '\n',
            1
        )
    END AS amount,
    data.price,
    stock.stock,
    map.world,
    map.x,
    map.y,
    map.z
FROM cfc_prod_quickshop.qs_shops shops
    JOIN cfc_prod_quickshop.qs_shop_map map ON shops.id = map.shop
    JOIN cfc_prod_quickshop.qs_data data ON shops.data = data.id
    JOIN zanderProd.users users ON users.uuid = data.owner
    JOIN cfc_prod_quickshop.qs_external_cache stock ON shops.id = stock.shop
WHERE data.unlimited = 0
ORDER BY shops.id

CREATE TABLE vault (
	vaultId INT NOT NULL AUTO_INCREMENT,
    displayName VARCHAR(30),
    description MEDIUMTEXT,
    redirectUrl TEXT,
    position INT,
    PRIMARY KEY (vaultId)
);

CREATE TABLE bridge (
	bridgeId INT NOT NULL AUTO_INCREMENT,
    command TEXT,
    targetServer VARCHAR(30),
    processed BOOLEAN DEFAULT 0,
    bridgeDateTime DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bridgeId)
);

CREATE TABLE logs (
	logId INT NOT NULL AUTO_INCREMENT,
    creatorId INT NOT NULL,
    logFeature VARCHAR(30),
    logType VARCHAR(30),
    description TEXT,
    actionedDateTime DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (logId)
);

CREATE VIEW zanderdev.punishments AS
SELECT
    litebans.uuid AS bannedUuid,
    banned.userId AS bannedUserId,
    litebans.banned_by_uuid AS bannedByUuid,
    banner.userId AS bannedByUserId,
    litebans.removed_by_uuid AS removedByUuid,
    remover.userId AS removedByUserId,
    litebans.type,
    litebans.active,
    litebans.silent,
    FROM_UNIXTIME(litebans.time/1000) AS dateStart,
    FROM_UNIXTIME(nullif((litebans.until / 1000), 0)) AS dateEnd,
    litebans.removed_by_date AS dateRemoved,
    litebans.reason,
    litebans.removed_by_reason AS reasonRemoved,
    litebans.ip,
    litebans.ipban,
    litebans.ipban_wildcard AS ipBanWildcard
FROM (
	SELECT
		uuid,
		ip,
		reason,
		banned_by_uuid,
		time,
		null AS until,
		null AS removed_by_uuid,
		null AS removed_by_reason,
		null AS removed_by_date,
		silent,
		ipban,
		ipban_wildcard,
		null AS active,
		'kick' AS type
	FROM cfcdev_litebans.litebans_kicks
	UNION
	SELECT
		uuid,
		ip,
		reason,
		banned_by_uuid,
		time,
		until,
		removed_by_uuid,
		removed_by_reason,
		removed_by_date,
		silent,
		ipban,
		ipban_wildcard,
		active,
		'ban' AS type
	FROM cfcdev_litebans.litebans_bans
	UNION
	SELECT
		uuid,
		ip,
		reason,
		banned_by_uuid,
		time,
		until,
		removed_by_uuid,
		removed_by_reason,
		removed_by_date,
		silent,
		ipban,
		ipban_wildcard,
		active,
		'mute' AS type
	FROM cfcdev_litebans.litebans_mutes
	UNION
	SELECT
		uuid,
		ip,
		reason,
		banned_by_uuid,
		time,
		until,
		removed_by_uuid,
		removed_by_reason,
		removed_by_date,
		silent,
		ipban,
		ipban_wildcard,
		active,
		'warning' AS type
	FROM cfcdev_litebans.litebans_warnings
) AS litebans
	LEFT JOIN zanderdev.users banned ON litebans.uuid = banned.uuid
    LEFT JOIN zanderdev.users banner ON litebans.banned_by_uuid = banner.uuid
    LEFT JOIN zanderdev.users remover ON litebans.removed_by_uuid = remover.uuid;
