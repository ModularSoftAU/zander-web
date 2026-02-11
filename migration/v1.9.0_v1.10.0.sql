-- Forms System Migration
-- Adds forms, form blocks, form responses, and updates applications table

CREATE TABLE IF NOT EXISTS forms (
    formId INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    createdByUserId INT NOT NULL,
    discordWebhookUrl TEXT,
    discordForumChannelId VARCHAR(255),
    postToForumEnabled TINYINT(1) NOT NULL DEFAULT 0,
    webhookEnabled TINYINT(1) NOT NULL DEFAULT 0,
    submitterCanView TINYINT(1) NOT NULL DEFAULT 1,
    requireLogin TINYINT(1) NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    PRIMARY KEY (formId),
    UNIQUE KEY forms_slug_unique (slug),
    INDEX forms_status_idx (status)
);

CREATE TABLE IF NOT EXISTS formBlocks (
    blockId INT NOT NULL AUTO_INCREMENT,
    formId INT NOT NULL,
    type ENUM(
        'short_answer',
        'paragraph',
        'multiple_choice',
        'checkboxes',
        'dropdown',
        'linear_scale',
        'title_description',
        'section_break'
    ) NOT NULL,
    orderIndex INT NOT NULL DEFAULT 0,
    required TINYINT(1) NOT NULL DEFAULT 0,
    label VARCHAR(255),
    description TEXT,
    config JSON,
    PRIMARY KEY (blockId),
    INDEX formBlocks_formId_idx (formId),
    INDEX formBlocks_order_idx (formId, orderIndex),
    CONSTRAINT fk_formBlocks_form FOREIGN KEY (formId) REFERENCES forms(formId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS formResponses (
    responseId INT NOT NULL AUTO_INCREMENT,
    formId INT NOT NULL,
    submittedByUserId INT,
    submittedAt DATETIME NOT NULL DEFAULT NOW(),
    answers JSON NOT NULL,
    status ENUM('new', 'reviewed', 'converted', 'archived') NOT NULL DEFAULT 'new',
    discordWebhookFailed TINYINT(1) NOT NULL DEFAULT 0,
    discordForumPostFailed TINYINT(1) NOT NULL DEFAULT 0,
    discordForumThreadId VARCHAR(255),
    ticketId INT,
    convertedByUserId INT,
    convertedAt DATETIME,
    PRIMARY KEY (responseId),
    INDEX formResponses_formId_idx (formId),
    INDEX formResponses_submitter_idx (submittedByUserId),
    INDEX formResponses_status_idx (status),
    CONSTRAINT fk_formResponses_form FOREIGN KEY (formId) REFERENCES forms(formId) ON DELETE CASCADE
);

-- Update applications table to support linked forms and external URLs
ALTER TABLE applications
    ADD COLUMN applicationType ENUM('external', 'linked_form') NOT NULL DEFAULT 'external' AFTER applicationStatus,
    ADD COLUMN linkedFormId INT AFTER applicationType;
