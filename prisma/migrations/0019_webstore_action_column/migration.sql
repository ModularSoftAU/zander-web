-- =============================================================================
-- Migration 0019: Add missing 'action' column to webstore command tables
-- =============================================================================
-- The webstoreStripeCommands and webstoreCommandRuns tables were created
-- before the 'action' column was added to the schema.  This migration adds
-- the column (defaulting to 'grant') and rebuilds the dependent indexes.
-- =============================================================================

-- webstoreStripeCommands: add action column and its index
ALTER TABLE `webstoreStripeCommands`
    ADD COLUMN `action` ENUM('grant','revoke') NOT NULL DEFAULT 'grant' AFTER `stripePriceId`,
    ADD INDEX  `webstoreStripeCommands_action` (`action`);

-- webstoreCommandRuns: add action column if it is also missing
ALTER TABLE `webstoreCommandRuns`
    ADD COLUMN `action` ENUM('grant','revoke') NOT NULL DEFAULT 'grant' AFTER `stripeSubscriptionId`;
