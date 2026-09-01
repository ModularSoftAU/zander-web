/**
 * services/user/_shared.js
 *
 * Private query helpers for the user data modules: promise wrappers over the
 * app DB and the LuckPerms DB, uuid normalisation, and the LuckPerms table
 * names. Not re-exported by controllers/userController.js.
 *
 * Extracted from controllers/userController.js (Phase 7 decomposition).
 */

import db, { luckpermsDb } from "../../controllers/databaseController.js";

export const LUCKPERMS_USER_PERMISSIONS_TABLE = "luckperms_user_permissions";
export const LUCKPERMS_GROUP_PERMISSIONS_TABLE = "luckperms_group_permissions";
export const LUCKPERMS_PLAYERS_TABLE = "luckperms_players";

export function normaliseUuid(uuid) {
  if (!uuid) return null;

  const trimmed = String(uuid).trim();
  if (!trimmed) return null;

  return trimmed.replace(/-/g, "").toLowerCase();
}

export function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

export function runLuckPermsQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    luckpermsDb.query(query, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}
