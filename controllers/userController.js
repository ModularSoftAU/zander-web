/**
 * controllers/userController.js
 *
 * Barrel for the user data-access layer. Implementation lives in per-concern
 * modules under services/user/ (Phase 7 decomposition):
 *
 *   _shared.js      — private runQuery / runLuckPermsQuery / uuid helpers
 *   getters.js      — UserGetter / UserLinkGetter lookup classes
 *   accounts.js     — local-account credential + state writes
 *   profile.js      — profile display fields
 *   permissions.js  — LuckPerms permission + rank resolution
 *   stats.js        — playtime/login stats, last session
 *   discordLink.js  — link/unlink Discord, placeholder-user merge
 */

export * from "../services/user/getters.js";
export * from "../services/user/accounts.js";
export * from "../services/user/profile.js";
export * from "../services/user/permissions.js";
export * from "../services/user/stats.js";
export * from "../services/user/discordLink.js";
