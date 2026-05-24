-- =============================================================================
-- Migration 0023: Link webstoreStripeCommands to webstorePackages by packageId
-- =============================================================================
-- Commands were previously keyed only by stripePriceId, which prevented
-- managing commands for packages that don't yet have a Stripe price set.
-- This migration adds a packageId column and back-fills it from webstorePackages
-- for any rows whose stripePriceId matches a known package.
--
-- stripePriceId is kept (nullable) as a cached field for fast webhook lookups.
-- New commands will have packageId set; legacy rows without a matching package
-- retain their stripePriceId-only association and still work for fulfillment.
-- =============================================================================

DROP PROCEDURE IF EXISTS _zander_migrate_0023;

CREATE PROCEDURE _zander_migrate_0023()
BEGIN
    -- Add packageId column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'webstoreStripeCommands'
          AND COLUMN_NAME  = 'packageId'
    ) THEN
        ALTER TABLE `webstoreStripeCommands`
            ADD COLUMN `packageId` INT NULL DEFAULT NULL
            AFTER `commandId`;
    END IF;

    -- Make stripePriceId nullable so commands can exist without a Stripe price
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'webstoreStripeCommands'
          AND COLUMN_NAME  = 'stripePriceId'
          AND IS_NULLABLE  = 'NO'
    ) THEN
        ALTER TABLE `webstoreStripeCommands`
            MODIFY COLUMN `stripePriceId` VARCHAR(120) NULL DEFAULT NULL;
    END IF;

    -- Back-fill packageId for any commands whose stripePriceId matches a package
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'webstorePackages'
    ) THEN
        UPDATE `webstoreStripeCommands` c
        JOIN   `webstorePackages` p ON p.stripePriceId = c.stripePriceId
        SET    c.packageId = p.packageId
        WHERE  c.packageId IS NULL
          AND  c.stripePriceId IS NOT NULL;
    END IF;
END;

CALL _zander_migrate_0023();

DROP PROCEDURE IF EXISTS _zander_migrate_0023;
