--
-- Migration for the Forums Feature & User Alerts System
--

-- Table to store forum categories.
-- `requiredPermission` can be used to restrict category visibility to users with a specific permission node.
CREATE TABLE forums_categories (
    categoryId INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INT NOT NULL DEFAULT 0,
    requiredPermission VARCHAR(255),
    PRIMARY KEY (categoryId)
);

-- Table to store discussion threads.
-- `uuid` is for user-friendly URLs.
-- `locked` and `stickied` are for moderation.
CREATE TABLE forums_discussions (
    discussionId INT NOT NULL AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    categoryId INT NOT NULL,
    authorId INT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    locked BOOLEAN NOT NULL DEFAULT 0,
    stickied BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (discussionId),
    INDEX (categoryId)
);

-- Table to store replies within a discussion.
-- `parentReplyId` allows for nested replies.
CREATE TABLE forums_replies (
    replyId INT NOT NULL AUTO_INCREMENT,
    discussionId INT NOT NULL,
    authorId INT NOT NULL,
    parentReplyId INT,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    PRIMARY KEY (replyId),
    INDEX (discussionId)
);

-- Table to store revisions for discussions and replies.
-- This creates an edit history for every post.
-- If `replyId` is NULL, the revision is for the main discussion post.
-- `active` flags the current version. `original` flags the first version. `archived` is for soft deletion.
CREATE TABLE forums_revisions (
    revisionId INT NOT NULL AUTO_INCREMENT,
    discussionId INT NOT NULL,
    replyId INT,
    authorId INT NOT NULL,
    title VARCHAR(255), -- The title of the discussion at the time of revision
    body MEDIUMTEXT,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT 1,
    original BOOLEAN NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (revisionId),
    INDEX (discussionId),
    INDEX (replyId)
);

-- Table for user alerts, primarily for forum post tagging.
CREATE TABLE user_alerts (
    alertId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL, -- The user being alerted
    creatorId INT, -- The user who triggered the alert
    alertType ENUM('FORUM_TAG') NOT NULL,
    referenceId VARCHAR(255), -- e.g., the URL/ID of the post
    readStatus BOOLEAN NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (alertId),
    INDEX (userId)
);
