USE zanderdev;

ALTER TABLE users
    ADD audit_lastDiscordMessage DATETIME,
    ADD audit_lastDiscordVoice DATETIME,
    ADD audit_lastMinecraftLogin DATETIME,
    ADD audit_lastMinecraftMessage DATETIME,
    ADD audit_lastMinecraftPunishment DATETIME,
    ADD audit_lastWebsiteLogin DATETIME;
