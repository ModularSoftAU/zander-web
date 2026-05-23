-- =============================================================================
-- Migration 0019: Add missing 'action' column to webstore command tables
-- =============================================================================
-- The webstoreStripeCommands and webstoreCommandRuns tables were created
-- before the 'action' ENUM column was present in the schema.  Column
-- position is omitted so these run regardless of which other columns exist.
-- =============================================================================

-- webstoreStripeCommands: add action column and its index (skip if already present)
ALTER TABLE `webstoreStripeCommands`
    ADD COLUMN IF NOT EXISTS `action` ENUM('grant','revoke') NOT NULL DEFAULT 'grant';

ALTER TABLE `webstoreStripeCommands`
    ADD INDEX IF NOT EXISTS `webstoreStripeCommands_action` (`action`);

-- webstoreCommandRuns: add action column (skip if already present)
ALTER TABLE `webstoreCommandRuns`
    ADD COLUMN IF NOT EXISTS `action` ENUM('grant','revoke') NOT NULL DEFAULT 'grant';
