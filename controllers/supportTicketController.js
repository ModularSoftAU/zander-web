/**
 * controllers/supportTicketController.js
 *
 * Barrel for the support-ticket service layer. The implementation was moved out
 * of this file (Phase 7 decomposition) into services/support/:
 *
 *   categories.js  — ticket categories + their role permissions + rank-role map
 *   users.js       — user lookups / staff-picker searches / rank queries
 *   tickets.js     — ticket CRUD, messages, participants, Discord channel sync,
 *                    status transitions (further split still pending)
 *   internal.js    — shared helpers (not re-exported; private to the slice)
 *
 * Every existing `import { ... } from ".../supportTicketController.js"` keeps
 * working via these re-exports.
 */

export * from "../services/support/categories.js";
export * from "../services/support/users.js";
export * from "../services/support/participants.js";
export * from "../services/support/tickets.js";
