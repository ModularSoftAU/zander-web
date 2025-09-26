USE zanderdev;

ALTER TABLE users
    ADD COLUMN email VARCHAR(255) UNIQUE AFTER account_disabled,
    ADD COLUMN email_verified BOOLEAN DEFAULT 0 AFTER email,
    ADD COLUMN email_verified_at DATETIME AFTER email_verified,
    ADD COLUMN email_verification_token VARCHAR(128) AFTER email_verified_at,
    ADD COLUMN email_verification_expires DATETIME AFTER email_verification_token,
    ADD COLUMN password_hash VARCHAR(255) AFTER email_verification_expires,
    ADD COLUMN password_reset_token VARCHAR(128) AFTER password_hash,
    ADD COLUMN password_reset_expires DATETIME AFTER password_reset_token;

CREATE INDEX email_verification_token_idx ON users (email_verification_token);
CREATE INDEX password_reset_token_idx ON users (password_reset_token);
