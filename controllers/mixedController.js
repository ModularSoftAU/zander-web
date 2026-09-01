/**
 * controllers/mixedController.js
 *
 * Barrel for the Mixed module data-access layer. The implementation lives in
 * per-concern modules under services/mixed/ (Phase 7 decomposition). Every
 * existing `import { ... } from ".../mixedController.js"` keeps working via
 * these re-exports.
 *
 *   _shared.js     — q/one/conn query helpers, uuid + json + display helpers
 *   settings.js    — mixed_settings
 *   servers.js     — server heartbeats / online state
 *   maps.js        — map rows, repo sync, sync-run log
 *   matches.js     — matches, match players/events, per-map play totals & records
 *   players.js     — player totals, leaderboards, achievements
 *   economy.js     — map tokens, token-spend requests, voting
 *   ratings.js     — map ratings + feedback
 *   entitlements.js— player ranks + entitlements
 *   overview.js    — admin / landing aggregates
 */

export { q, isValidUuid, normaliseUuid, sanitiseFeedback } from "../services/mixed/_shared.js";
export * from "../services/mixed/settings.js";
export * from "../services/mixed/servers.js";
export * from "../services/mixed/maps.js";
export * from "../services/mixed/matches.js";
export * from "../services/mixed/players.js";
export * from "../services/mixed/economy.js";
export * from "../services/mixed/ratings.js";
export * from "../services/mixed/entitlements.js";
export * from "../services/mixed/overview.js";
