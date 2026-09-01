-- ============================================================
-- Friends system — friendships, one-directional blocks, privacy settings.
--
-- One source of truth for both the website and in-game (via the token API).
-- No per-rank limits anywhere: a single high unadvertised friend ceiling is
-- enforced in the controller as an abuse backstop, not in the schema.
--
-- Notes the schema cannot express (enforced in controllers/friendController.js):
--   * accepted rows keep their requester/addressee orientation — never
--     canonicalised. Friend reads use
--       WHERE (requesterId = ? OR addresseeId = ?) AND status = 'accepted'
--   * the unique index only stops duplicates in ONE direction. Before inserting
--     the controller checks the reverse pair and resolves a mutual request as an
--     accept rather than a second pending row.
--   * declined rows are retained for spam rate-limiting but must not permanently
--     block a later genuine request — re-request allowed after a 24h cooldown.
--   * removing a friend DELETEs the row (no tombstone, so re-adding works).
--   * deliveredAt drives offline delivery: on login deliver everything where
--     status = 'pending' AND deliveredAt IS NULL.
-- ============================================================

CREATE TABLE userFriendships (
    friendshipId  INT                                   NOT NULL AUTO_INCREMENT,
    requesterId   INT                                   NOT NULL,
    addresseeId   INT                                   NOT NULL,
    status        ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
    source        ENUM('web','game','discord')          NOT NULL DEFAULT 'web',
    message       VARCHAR(140)                          NULL,
    requestedAt   DATETIME                              NOT NULL DEFAULT NOW(),
    respondedAt   DATETIME                              NULL,
    deliveredAt   DATETIME                              NULL,
    PRIMARY KEY (friendshipId),
    UNIQUE KEY userFriendships_pair_uq (requesterId, addresseeId),
    KEY userFriendships_addressee_status_idx (addresseeId, status),
    KEY userFriendships_requester_status_idx (requesterId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blocks are one-directional and a SEPARATE table from friendships — never a
-- friendship status. The blockedId index carries "is the viewer blocked by this
-- profile owner?", which runs on every public profile render.
CREATE TABLE userBlocks (
    blockId    INT                 NOT NULL AUTO_INCREMENT,
    blockerId  INT                 NOT NULL,
    blockedId  INT                 NOT NULL,
    source     ENUM('web','game')  NOT NULL DEFAULT 'web',
    reason     VARCHAR(255)        NULL,
    createdAt  DATETIME            NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blockId),
    UNIQUE KEY userBlocks_pair_uq (blockerId, blockedId),
    KEY userBlocks_blocked_idx (blockedId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rows are created lazily. Reads apply defaults when a row is absent — the app
-- does not backfill every user.
CREATE TABLE userPrivacySettings (
    userId               INT                              NOT NULL,
    allowMessagesFrom    ENUM('everyone','friends','none') NOT NULL DEFAULT 'everyone',
    allowFriendRequests  ENUM('everyone','friends','none') NOT NULL DEFAULT 'everyone',
    friendsListVisible   TINYINT(1)                        NOT NULL DEFAULT 1,
    notifyFriendJoin     TINYINT(1)                        NOT NULL DEFAULT 1,
    notifyFriendRequest  TINYINT(1)                        NOT NULL DEFAULT 1,
    updatedAt            DATETIME                          NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    PRIMARY KEY (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
