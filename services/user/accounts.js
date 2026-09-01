/**
 * services/user/accounts.js
 *
 * Local-account credential + account-state writes (create, credentials, email-verified, placeholder flag, registered timestamp, password).
 *
 * Extracted from controllers/userController.js (Phase 7 decomposition).
 * Re-exported by the controllers/userController.js barrel.
 */

import db from "../../controllers/databaseController.js";

export function createLocalUser({ uuid, username, email, passwordHash }) {
  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO users (uuid, username, email, password_hash) VALUES (?, ?, ?, ?)`,
      [uuid, username, email, passwordHash],
      function (error, results) {
        if (error) {
          return reject(error);
        }

        resolve({ userId: results.insertId });
      }
    );
  });
}

export function updateLocalUserCredentials(
  userId,
  { email, passwordHash, username }
) {
  return new Promise((resolve, reject) => {
    const updates = [];
    const params = [];

    if (typeof email !== "undefined") {
      updates.push(`email = ?`);
      params.push(email);
    }

    if (typeof passwordHash !== "undefined") {
      updates.push(`password_hash = ?`);
      params.push(passwordHash);
    }

    if (typeof username !== "undefined") {
      updates.push(`username = ?`);
      params.push(username);
    }

    updates.push(`email_verified = 0`);
    updates.push(`email_verified_at = NULL`);

    params.push(userId);

    db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE userId = ?`,
      params,
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

export function markEmailVerified(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE userId = ?`,
      [userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

export function clearPlaceholderFlag(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET is_placeholder = 0 WHERE userId = ?`,
      [userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

export function markAccountRegistered(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET account_registered = NOW() WHERE userId = ?`,
      [userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

export function updateUserPassword(userId, passwordHash) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET password_hash = ? WHERE userId = ?`,
      [passwordHash, userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

