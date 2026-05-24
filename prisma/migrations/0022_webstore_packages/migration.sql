-- =============================================================================
-- Migration 0022: Create webstorePackages table
-- =============================================================================
-- Moves webstore package/product definitions from Stripe into the website DB.
-- Each package optionally links to a Stripe price via stripePriceId (used for
-- checkout sessions). Commands in webstoreStripeCommands continue to reference
-- packages by stripePriceId.
-- =============================================================================

DROP PROCEDURE IF EXISTS _zander_migrate_0022;

CREATE PROCEDURE _zander_migrate_0022()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'webstorePackages'
    ) THEN
        CREATE TABLE `webstorePackages` (
            `packageId`     INT            NOT NULL AUTO_INCREMENT,
            `stripePriceId` VARCHAR(120)   DEFAULT NULL COMMENT 'Stripe price ID used for checkout sessions',
            `displayName`   VARCHAR(255)   NOT NULL,
            `description`   TEXT           DEFAULT NULL,
            `imageUrl`      VARCHAR(512)   DEFAULT NULL,
            `priceCents`    INT            NOT NULL DEFAULT 0,
            `currency`      VARCHAR(10)    NOT NULL DEFAULT 'usd',
            `purchaseType`  ENUM('one_time','subscription') NOT NULL DEFAULT 'one_time',
            `sortOrder`     INT            NOT NULL DEFAULT 0,
            `isActive`      TINYINT(1)     NOT NULL DEFAULT 1,
            `createdAt`     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updatedAt`     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`packageId`),
            UNIQUE KEY `uq_stripePriceId` (`stripePriceId`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    END IF;
END;

CALL _zander_migrate_0022();

DROP PROCEDURE IF EXISTS _zander_migrate_0022;
