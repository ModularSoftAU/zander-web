CREATE TABLE supportTickets (
    ticketId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    categoryId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    status ENUM('open', 'closed', 'in-progress') NOT NULL DEFAULT 'open',
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    PRIMARY KEY (ticketId),
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES supportTicketCategories(categoryId) ON DELETE CASCADE
);

CREATE TABLE supportTicketMessages (
    messageId INT NOT NULL AUTO_INCREMENT,
    ticketId INT NOT NULL,
    userId INT NOT NULL,
    message TEXT NOT NULL,
    attachments JSON,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (messageId),
    FOREIGN KEY (ticketId) REFERENCES supportTickets(ticketId) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE supportTicketCategories (
    categoryId INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    PRIMARY KEY (categoryId)
);

CREATE TABLE supportTicketCategoryPermissions (
    permissionId INT NOT NULL AUTO_INCREMENT,
    categoryId INT NOT NULL,
    roleId VARCHAR(255) NOT NULL,
    PRIMARY KEY (permissionId),
    FOREIGN KEY (categoryId) REFERENCES supportTicketCategories(categoryId) ON DELETE CASCADE
);
