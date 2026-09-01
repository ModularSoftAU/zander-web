-- Vanish presence fix.
-- A `hidden` session is one whose player is currently vanished (PremiumVanish).
-- Public presence reads must exclude hidden sessions so a vanished player is
-- indistinguishable from an offline one. The proxy sets this flag through
-- POST /api/session/vanish; it is never written from the web UI.

ALTER TABLE `gameSessions`
    ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false;

-- Supports the "latest visible session for this user" lookup in getUserLastSession().
CREATE INDEX `gameSessions_userId_hidden_sessionStart_idx`
    ON `gameSessions` (`userId`, `hidden`, `sessionStart`);
