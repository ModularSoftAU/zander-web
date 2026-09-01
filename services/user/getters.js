/**
 * services/user/getters.js
 *
 * UserGetter / UserLinkGetter lookup classes (by username / email / userId / verify code, and the verify-link -> account linking writes).
 *
 * Extracted from controllers/userController.js (Phase 7 decomposition).
 * Re-exported by the controllers/userController.js barrel.
 */

import db from "../../controllers/databaseController.js";

export function UserGetter() {
  this.byUsername = function (username) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE username=?;`,
        [username],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.byEmail = function (email) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE LOWER(email)=LOWER(?);`,
        [email],
        function (error, results) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null);
          } else {
            resolve(results[0]);
          }
        }
      );
    });
  };

  this.byUserId = function (userId) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE userId=?;`,
        [userId],
        function (error, results) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null);
          } else {
            resolve(results[0]);
          }
        }
      );
    });
  };

  this.byUsernameOrEmail = async function (identifier) {
    const byUsername = await this.byUsername(identifier);
    if (byUsername) {
      return byUsername;
    }

    return await this.byEmail(identifier);
  };

  this.byUUID = function (uuid) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE uuid=?;`,
        [uuid],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }
          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  // Find a placeholder ("ghost") row that collides with a registration
  // attempt. Placeholder rows are created by createUnlinkedUser with a
  // lowercased Discord username and a random non-Mojang UUID, so the
  // realistic collision is a case-insensitive username match; a UUID
  // match is also honoured for completeness.
  this.placeholderMatch = function (username, uuid = null) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users
          WHERE is_placeholder = 1
            AND (LOWER(username) = LOWER(?) OR (? IS NOT NULL AND uuid = ?))
          LIMIT 1;`,
        [username, uuid, uuid],
        function (error, results) {
          if (error) {
            reject(error);
            return;
          }

          resolve(results && results.length ? results[0] : null);
        }
      );
    });
  };

  this.byDiscordId = function (discordId) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE discordId=?;`,
        [discordId],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.hasJoined = async function (username, uuid = null) {
    const trimmedUsername = username ? username.trim() : null;
    const trimmedUuid = uuid ? uuid.trim() : null;

    const runQuery = (sql, params) =>
      new Promise((resolve, reject) => {
        db.query(sql, params, (error, results) => {
          if (error) {
            return reject(error);
          }

          resolve(results || []);
        });
      });

    if (trimmedUsername) {
      const usernameMatch = await runQuery(
        `SELECT 1 FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [trimmedUsername]
      );

      if (usernameMatch.length) {
        return true;
      }
    }

    if (trimmedUuid) {
      const uuidMatch = await runQuery(
        `SELECT 1 FROM users WHERE uuid = ? LIMIT 1`,
        [trimmedUuid]
      );

      if (uuidMatch.length) {
        return true;
      }
    }

    if (!trimmedUsername) {
      return false;
    }

    const luckPermsParams = [trimmedUsername];
    let luckPermsQuery =
      `SELECT 1 FROM luckperms_players WHERE LOWER(username) = LOWER(?) LIMIT 1`;

    if (trimmedUuid) {
      // LuckPerms MySQL stores uuid as VARCHAR(36) with dashes — compare
      // directly, no UNHEX() (which would produce binary that never matches).
      luckPermsQuery =
        `SELECT 1 FROM luckperms_players WHERE LOWER(username) = LOWER(?) OR LOWER(uuid) = LOWER(?) LIMIT 1`;
      luckPermsParams.push(trimmedUuid);
    }

    const luckPermsMatch = await new Promise((resolve, reject) => {
      luckpermsDb.query(luckPermsQuery, luckPermsParams, (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      });
    });

    return luckPermsMatch.length > 0;
  };

  this.getBedrockUuid = async function (username) {
    const trimmedUsername = username ? username.trim() : null;
    if (!trimmedUsername) return null;

    const runQuery = (sql, params) =>
      new Promise((resolve, reject) => {
        db.query(sql, params, (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        });
      });

    // Check users table first
    const userRows = await runQuery(
      `SELECT uuid FROM users WHERE LOWER(username) = LOWER(?) AND uuid IS NOT NULL LIMIT 1`,
      [trimmedUsername]
    );
    if (userRows.length && userRows[0].uuid) {
      return userRows[0].uuid;
    }

    // Check luckperms_players table. LuckPerms MySQL stores uuid as
    // VARCHAR(36) with dashes already — select it as-is, no HEX() needed.
    const luckPermsRows = await new Promise((resolve, reject) => {
      luckpermsDb.query(
        `SELECT LOWER(uuid) AS uuid FROM luckperms_players WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [trimmedUsername],
        (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        }
      );
    });
    if (luckPermsRows.length && luckPermsRows[0].uuid) {
      return luckPermsRows[0].uuid;
    }

    return null;
  };

  this.isRegistered = function (discordId) {
    return new Promise((resolve, reject) => {
      // Execute a SQL query to check if the user exists in the database
      db.query(
        `SELECT * FROM users WHERE discordId=?;`,
        [discordId],
        function (error, results, fields) {
          if (error) {
            // If there's an error with the database query, reject the Promise
            reject(error);
          }

          // Check if the query returned any results
          if (!results || !results.length) {
            // If no results were found, resolve with false (user not registered)
            resolve(false);
          } else {
            // If results were found, resolve with true (user is registered)
            resolve(true);
          }
        }
      );
    });
  };
}

export function UserLinkGetter() {
  this.getUserByCode = function (code) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT u.*, uv.verifyId FROM users u JOIN userVerifyLink uv ON u.uuid = uv.uuid WHERE uv.linkCode = ? AND uv.codeExpiry > NOW();`,
        [code],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          if (!results || !results.length) {
            resolve(null); // User not found
          } else {
            resolve(results[0]); // Resolve with user data
          }
        }
      );
    });
  };

  this.link = function (uuid, discordId) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE users SET discordId=?, account_registered=? WHERE uuid=?`,
        [discordId, new Date(), uuid],
        function (error, results, fields) {
          if (error) {
            reject(error);
          }

          db.query(
            `DELETE FROM userVerifyLink WHERE uuid=?`,
            [uuid],
            function (deleteError) {
              if (deleteError) {
                return reject(deleteError);
              }

              resolve(true);
            }
          );
        }
      );
    });
  };

  this.markWebsiteRegistrationComplete = function (uuid) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE users SET account_registered=? WHERE uuid=?`,
        [new Date(), uuid],
        function (error) {
          if (error) {
            return reject(error);
          }

          db.query(
            `DELETE FROM userVerifyLink WHERE uuid=?`,
            [uuid],
            function (deleteError) {
              if (deleteError) {
                return reject(deleteError);
              }

              resolve(true);
            }
          );
        }
      );
    });
  };
}

