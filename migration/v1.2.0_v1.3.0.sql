USE zanderdev;

ALTER TABLE users
    ADD email VARCHAR(254) UNIQUE,
    ADD password_hash VARCHAR(255),
    ADD email_verified BOOLEAN DEFAULT 0,
    ADD email_verified_at DATETIME;

CREATE TABLE IF NOT EXISTS userEmailVerifications (
    verificationId INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    codeHash VARCHAR(255) NOT NULL,
    expiresAt DATETIME NOT NULL,
    consumed BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT NOW(),
    consumedAt DATETIME,
    PRIMARY KEY (verificationId),
    INDEX userEmailVerifications_userId (userId),
    CONSTRAINT fk_userEmailVerifications_users FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);
