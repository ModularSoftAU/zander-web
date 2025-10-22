USE zanderdev;

CREATE TABLE IF NOT EXISTS forumCategories (
    categoryId INT NOT NULL AUTO_INCREMENT,
    parentCategoryId INT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    position INT DEFAULT 0,
    viewPermission VARCHAR(150),
    postPermission VARCHAR(150),
    createdAt DATETIME DEFAULT NOW(),
    updatedAt DATETIME DEFAULT NOW() ON UPDATE NOW(),
    PRIMARY KEY (categoryId),
    UNIQUE KEY forumCategories_slug_unique (slug),
    INDEX forumCategories_parent_idx (parentCategoryId),
    CONSTRAINT fk_forumCategories_parent FOREIGN KEY (parentCategoryId) REFERENCES forumCategories(categoryId) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS forumDiscussions (
    discussionId INT NOT NULL AUTO_INCREMENT,
    categoryId INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    createdBy INT NOT NULL,
    createdAt DATETIME DEFAULT NOW(),
    updatedAt DATETIME DEFAULT NOW() ON UPDATE NOW(),
    lastPostAt DATETIME DEFAULT NOW(),
    lastPostBy INT,
    isLocked TINYINT(1) DEFAULT 0,
    isSticky TINYINT(1) DEFAULT 0,
    isArchived TINYINT(1) DEFAULT 0,
    PRIMARY KEY (discussionId),
    UNIQUE KEY forumDiscussions_slug_unique (categoryId, slug),
    INDEX forumDiscussions_category_idx (categoryId),
    INDEX forumDiscussions_lastPost_idx (lastPostAt),
    CONSTRAINT fk_forumDiscussions_category FOREIGN KEY (categoryId) REFERENCES forumCategories(categoryId) ON DELETE CASCADE,
    CONSTRAINT fk_forumDiscussions_creator FOREIGN KEY (createdBy) REFERENCES users(userId) ON DELETE CASCADE,
    CONSTRAINT fk_forumDiscussions_lastPostUser FOREIGN KEY (lastPostBy) REFERENCES users(userId) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS forumPosts (
    postId INT NOT NULL AUTO_INCREMENT,
    discussionId INT NOT NULL,
    userId INT NOT NULL,
    content MEDIUMTEXT NOT NULL,
    isOriginal TINYINT(1) DEFAULT 0,
    createdAt DATETIME DEFAULT NOW(),
    updatedAt DATETIME DEFAULT NOW() ON UPDATE NOW(),
    PRIMARY KEY (postId),
    INDEX forumPosts_discussion_idx (discussionId),
    INDEX forumPosts_user_idx (userId),
    CONSTRAINT fk_forumPosts_discussion FOREIGN KEY (discussionId) REFERENCES forumDiscussions(discussionId) ON DELETE CASCADE,
    CONSTRAINT fk_forumPosts_user FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS forumPostRevisions (
    revisionId INT NOT NULL AUTO_INCREMENT,
    postId INT NOT NULL,
    editorId INT,
    previousContent MEDIUMTEXT NOT NULL,
    createdAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (revisionId),
    INDEX forumPostRevisions_post_idx (postId),
    CONSTRAINT fk_forumPostRevisions_post FOREIGN KEY (postId) REFERENCES forumPosts(postId) ON DELETE CASCADE,
    CONSTRAINT fk_forumPostRevisions_editor FOREIGN KEY (editorId) REFERENCES users(userId) ON DELETE SET NULL
);
