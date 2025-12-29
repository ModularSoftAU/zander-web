CREATE TABLE webstorePurchases (
    purchaseId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    itemSlug VARCHAR(64) NOT NULL,
    itemName VARCHAR(120) NOT NULL,
    purchaseType ENUM('one_time', 'subscription') NOT NULL,
    purchaserMinecraftUsername VARCHAR(16) NOT NULL,
    recipientMinecraftUsername VARCHAR(16) NOT NULL,
    status ENUM('pending', 'paid', 'fulfilled', 'failed') DEFAULT 'pending',
    stripeSessionId VARCHAR(255) NOT NULL,
    stripePaymentIntentId VARCHAR(255),
    stripeSubscriptionId VARCHAR(255),
    amountCents INT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    isGift TINYINT(1) DEFAULT 0,
    createdAt DATETIME DEFAULT NOW(),
    updatedAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (purchaseId),
    UNIQUE KEY webstorePurchases_session (stripeSessionId),
    INDEX webstorePurchases_user (userId),
    INDEX webstorePurchases_status (status),
    CONSTRAINT fk_webstorePurchases_users FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE webstoreCommandRuns (
    commandRunId INT NOT NULL AUTO_INCREMENT,
    purchaseId INT NOT NULL,
    commandTemplate TEXT NOT NULL,
    resolvedCommand TEXT NOT NULL,
    executorTaskId INT NULL,
    status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
    attempts INT DEFAULT 0,
    lastError TEXT,
    createdAt DATETIME DEFAULT NOW(),
    updatedAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (commandRunId),
    INDEX webstoreCommandRuns_purchase (purchaseId),
    INDEX webstoreCommandRuns_executor (executorTaskId),
    CONSTRAINT fk_webstoreCommandRuns_purchase FOREIGN KEY (purchaseId) REFERENCES webstorePurchases(purchaseId) ON DELETE CASCADE
);

CREATE TABLE webstoreWebhookEvents (
    webhookEventId INT NOT NULL AUTO_INCREMENT,
    stripeEventId VARCHAR(255) NOT NULL,
    purchaseId INT NULL,
    eventType VARCHAR(80) NOT NULL,
    payload JSON,
    createdAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (webhookEventId),
    UNIQUE KEY webstoreWebhookEvents_event (stripeEventId),
    INDEX webstoreWebhookEvents_purchase (purchaseId),
    CONSTRAINT fk_webstoreWebhookEvents_purchase FOREIGN KEY (purchaseId) REFERENCES webstorePurchases(purchaseId) ON DELETE SET NULL
);

CREATE TABLE webstoreItems (
    itemId INT NOT NULL AUTO_INCREMENT,
    slug VARCHAR(64) NOT NULL UNIQUE,
    displayName VARCHAR(120) NOT NULL,
    description TEXT,
    priceCents INT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    purchaseType ENUM('one_time', 'subscription') NOT NULL,
    stripePriceId VARCHAR(120) NOT NULL,
    isActive TINYINT(1) DEFAULT 1,
    sortOrder INT DEFAULT 0,
    createdAt DATETIME DEFAULT NOW(),
    updatedAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (itemId)
);

CREATE TABLE webstoreItemCommands (
    itemCommandId INT NOT NULL AUTO_INCREMENT,
    itemId INT NOT NULL,
    commandTemplate TEXT NOT NULL,
    sortOrder INT DEFAULT 0,
    createdAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (itemCommandId),
    INDEX webstoreItemCommands_item (itemId),
    CONSTRAINT fk_webstoreItemCommands_item FOREIGN KEY (itemId) REFERENCES webstoreItems(itemId) ON DELETE CASCADE
);

CREATE TABLE webstoreTransactions (
    transactionId INT NOT NULL AUTO_INCREMENT,
    purchaseId INT NOT NULL,
    userId INT NOT NULL,
    direction ENUM('incoming', 'outgoing') NOT NULL,
    counterpartyMinecraftUsername VARCHAR(16) NOT NULL,
    amountCents INT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    createdAt DATETIME DEFAULT NOW(),
    PRIMARY KEY (transactionId),
    INDEX webstoreTransactions_user (userId),
    INDEX webstoreTransactions_purchase (purchaseId)
);

CREATE TABLE webstoreContacts (
    contactId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    minecraftUsername VARCHAR(16) NOT NULL,
    lastTransactionAt DATETIME DEFAULT NOW(),
    lastTransactionDirection ENUM('incoming', 'outgoing') NOT NULL,
    PRIMARY KEY (contactId),
    UNIQUE KEY webstoreContacts_user (userId, minecraftUsername)
);
