/**
 * services/webstore/_shared.js
 *
 * Private query helper over the mysql2 pool, shared by the webstore concern
 * modules. Not re-exported by controllers/webstoreController.js.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 */

import db from "../../controllers/databaseController.js";

export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      return resolve(results);
    });
  });
}
