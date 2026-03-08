USE zanderdev;

CREATE TABLE IF NOT EXISTS userPasswordResets (
    resetId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    codeHash VARCHAR(255) NOT NULL,
    expiresAt DATETIME NOT NULL,
    consumed BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT NOW(),
    consumedAt DATETIME,
    PRIMARY KEY (resetId),
    INDEX userPasswordResets_userId (userId),
    CONSTRAINT fk_userPasswordResets_users FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);
