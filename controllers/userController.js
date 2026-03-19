import { hashEmail } from "../api/common.js";
import db, { luckpermsDb } from "./databaseController.js";

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
      luckPermsQuery =
        `SELECT 1 FROM luckperms_players WHERE LOWER(username) = LOWER(?) OR uuid = UNHEX(REPLACE(?, '-', '')) LIMIT 1`;
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

    // Check luckperms_players table
    const luckPermsRows = await new Promise((resolve, reject) => {
      luckpermsDb.query(
        `SELECT LOWER(HEX(uuid)) AS hexUuid FROM luckperms_players WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [trimmedUsername],
        (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        }
      );
    });
    if (luckPermsRows.length && luckPermsRows[0].hexUuid) {
      const hex = luckPermsRows[0].hexUuid;
      if (hex.length === 32) {
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`.toLowerCase();
      }
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

export async function getProfilePicture(username) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM users WHERE username=?;`,
      [username],
      async function (error, results, fields) {
        if (error) {
          reject(error);
        }

        let profilePictureType = results[0].profilePicture_type;

        if (profilePictureType == "CRAFTATAR") {
          let craftUUID = results[0].uuid;
          return resolve(`https://crafthead.net/helm/${craftUUID}`);
        }

        if (profilePictureType == "GRAVATAR") {
          let email = results[0].profilePicture_email;
          let emailHash = await hashEmail(email); // Await here
          return resolve(`https://gravatar.com/avatar/${emailHash}?size=300`);
        }
      }
    );
  });
}

export async function setProfileDisplayPreferences(
  userId,
  profilePicture_type,
  profilePicture_email
) {
  db.query(
    `UPDATE users SET profilePicture_type=?, profilePicture_email=? WHERE userId=?;`,
    [profilePicture_type, profilePicture_email, userId],
    function (error, results, fields) {
      if (error) {
        console.error("Failed to update profile display preferences", error);
      }
    }
  );
}

export async function setProfileUserInterests(
  userId,
  social_interests
) {
  db.query(
    `UPDATE users SET social_interests=? WHERE userId=?;`,
    [social_interests, userId],
    function (error, results, fields) {
      if (error) {
        console.error("Failed to update profile interests", error);
      }
    }
  );
}

export async function setProfileSocialConnections(
  userId,
  social_discord,
  social_steam,
  social_twitter_x,
  social_instagram,
  social_reddit,
  social_spotify
) {
  db.query(
    `UPDATE users SET social_discord=?, social_steam=?, social_twitter_x=?, social_instagram=?, social_reddit=?, social_spotify=? WHERE userId=?;`,
    [
      social_discord,
      social_steam,
      social_twitter_x,
      social_instagram,
      social_reddit,
      social_spotify,
      userId,
    ],
    function (error, results, fields) {
      if (error) {
        console.error("Failed to update social connections", error);
      }
    }
  );
}

export async function setProfileUserAboutMe(
  userId,
  social_aboutMe
) {
  db.query(
    `UPDATE users SET social_aboutMe=? WHERE userId=?;`,
    [social_aboutMe, userId],
    function (error, results, fields) {
      if (error) {
        console.error("Failed to update profile bio", error);
      }
    }
  );
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

const LUCKPERMS_USER_PERMISSIONS_TABLE = "luckperms_user_permissions";
const LUCKPERMS_GROUP_PERMISSIONS_TABLE = "luckperms_group_permissions";
const LUCKPERMS_PLAYERS_TABLE = "luckperms_players";

function normaliseUuid(uuid) {
  if (!uuid) return null;

  const trimmed = String(uuid).trim();
  if (!trimmed) return null;

  return trimmed.replace(/-/g, "").toLowerCase();
}

function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

function runLuckPermsQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    luckpermsDb.query(query, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

export async function getUserPermissions(userData = {}) {
  const permissionSet = new Set();
  const directRankOrder = [];
  const seenDirectRanks = new Set();
  const queuedRanks = [];
  const queuedRankSet = new Set();

  const userId = userData?.userId || null;
  const rawUuid = userData?.uuid || null;
  const username = userData?.username || null;

  let uuidHex = normaliseUuid(rawUuid);

  const ensureUuid = async () => {
    if (uuidHex) {
      return;
    }

    if (userId) {
      const rows = await runQuery(
        `SELECT uuid FROM users WHERE userId = ? LIMIT 1`,
        [userId]
      );

      if (rows.length && rows[0].uuid) {
        uuidHex = normaliseUuid(rows[0].uuid);
        return;
      }
    }

    if (username) {
      const rows = await runLuckPermsQuery(
        `SELECT LOWER(HEX(uuid)) AS uuid FROM ${LUCKPERMS_PLAYERS_TABLE} WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username]
      );

      if (rows.length && rows[0].uuid) {
        uuidHex = rows[0].uuid;
      }
    }
  };

  await ensureUuid();

  if (!uuidHex && !userId) {
    const emptyPermissions = [];
    emptyPermissions.userRanks = [];
    return emptyPermissions;
  }

  const pushPermission = (value) => {
    if (!value) return;
    permissionSet.add(value);
  };

  const queueRank = (slug, { direct = false } = {}) => {
    if (!slug) {
      return;
    }

    if (direct && !seenDirectRanks.has(slug)) {
      seenDirectRanks.add(slug);
      directRankOrder.push(slug);
    }

    if (!queuedRankSet.has(slug)) {
      queuedRankSet.add(slug);
      queuedRanks.push(slug);
    }
  };

  if (uuidHex) {
    try {
      const directPermissions = await runLuckPermsQuery(
        `SELECT permission
           FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = UNHEX(?)
            AND permission NOT LIKE 'group.%'
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
        [uuidHex]
      );

      directPermissions.forEach(({ permission }) => pushPermission(permission));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch direct user permissions:", error);
    }

    try {
      const rankRows = await runLuckPermsQuery(
        `SELECT SUBSTRING_INDEX(permission, '.', -1) AS rankSlug
           FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = UNHEX(?)
            AND permission LIKE 'group.%'
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())
          ORDER BY permission`,
        [uuidHex]
      );

      rankRows.forEach(({ rankSlug }) => queueRank(rankSlug, { direct: true }));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch user group assignments:", error);
    }
  }

  if (!directRankOrder.length && userId) {
    try {
      const fallbackRanks = await runQuery(
        `SELECT rankSlug
           FROM userRanks
          WHERE userId = ?`,
        [userId]
      );

      fallbackRanks.forEach(({ rankSlug }) => queueRank(rankSlug, { direct: true }));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch fallback ranks from userRanks:", error);
    }
  }

  if (!queuedRanks.length && uuidHex) {
    try {
      const primaryGroupRows = await runLuckPermsQuery(
        `SELECT primary_group AS rankSlug
           FROM ${LUCKPERMS_PLAYERS_TABLE}
          WHERE uuid = UNHEX(?)
          LIMIT 1`,
        [uuidHex]
      );

      primaryGroupRows.forEach(({ rankSlug }) => queueRank(rankSlug, { direct: true }));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch primary group:", error);
    }
  }

  while (queuedRanks.length) {
    const currentRank = queuedRanks.shift();

    try {
      const groupPermissions = await runLuckPermsQuery(
        `SELECT permission
           FROM ${LUCKPERMS_GROUP_PERMISSIONS_TABLE}
          WHERE name = ?
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
        [currentRank]
      );

      groupPermissions.forEach(({ permission }) => {
        if (!permission) {
          return;
        }

        if (permission.startsWith("group.")) {
          const inherited = permission.substring("group.".length).trim();
          if (inherited && inherited !== currentRank) {
            queueRank(inherited);
          }
          return;
        }

        pushPermission(permission);
      });
    } catch (error) {
      console.error(`[PERMISSIONS] Failed to fetch permissions for group '${currentRank}':`, error);
    }
  }

  if (userId) {
    try {
      const fallbackPermissions = await runQuery(
        `SELECT DISTINCT permission
           FROM userPermissions
          WHERE userId = ?`,
        [userId]
      );

      fallbackPermissions.forEach(({ permission }) => pushPermission(permission));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch fallback user permissions:", error);
    }
  }

  // Fallback: also resolve group permissions via the rankPermissions view
  // for all known groups, in case the direct group_permissions query missed any
  if (queuedRankSet.size > 0) {
    try {
      const groupSlugs = Array.from(queuedRankSet);
      const placeholders = groupSlugs.map(() => "?").join(", ");
      const fallbackGroupPerms = await runQuery(
        `SELECT DISTINCT permission
           FROM rankPermissions
          WHERE rankSlug IN (${placeholders})`,
        groupSlugs
      );

      fallbackGroupPerms.forEach(({ permission }) => pushPermission(permission));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch fallback rank permissions:", error);
    }
  }

  const permissions = Array.from(permissionSet);
  permissions.userRanks = directRankOrder;

  return permissions;
}

export async function getUserStats(userId) {
  const playtimeResult = await new Promise((resolve, reject) => {
    db.query(
      `SELECT SUM(TIME_TO_SEC(TIMEDIFF(COALESCE(sessionEnd, NOW()), sessionStart))) AS totalSeconds FROM gameSessions WHERE userId=?`,
      [userId],
      function (err, results) {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });

  const loginsResult = await new Promise((resolve, reject) => {
    db.query(
      `SELECT COUNT(*) AS totalLogins FROM gameSessions WHERE userId = ?`,
      [userId],
      function (err, results) {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });

  return {
    totalPlaytime: convertSecondsToDuration(playtimeResult[0].totalSeconds),
    totalLogins: loginsResult[0].totalLogins,
  };
}

export function convertSecondsToDuration(seconds) {
  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;

  if (seconds < MINUTE) {
    return `${seconds} seconds`;
  } else if (seconds < HOUR) {
    return `${Math.floor(seconds / MINUTE)} minutes`;
  } else if (seconds < DAY) {
    return `${Math.floor(seconds / HOUR)} hours`;
  } else if (seconds < MONTH) {
    return `${Math.floor(seconds / DAY)} days`;
  } else {
    return `${Math.floor(seconds / MONTH)} months`;
  }
}

export async function getRankPermissions(allRanks) {
  return new Promise((resolve) => {
    db.query(
      `SELECT DISTINCT permission FROM rankPermissions WHERE FIND_IN_SET(rankSlug, ?)`,
      [allRanks.join()],
      async function (err, results) {
        if (err) {
          throw err;
        }

        let rankPermissions = results.map((a) => a.permission);
        resolve(rankPermissions);
      }
    );
  });
}

export async function getUserRanks(userData, userRanks = null) {
  return new Promise((resolve) => {
    // Call with just userData only get directly assigned Ranks
    if (userRanks === null) {
      db.query(
        `SELECT rankSlug, title FROM userRanks WHERE userId = ?`,
        [userData.userId],
        async function (err, results) {
          if (err) {
            throw err;
          }

          let userRanks = results.map((a) => ({
            ["rankSlug"]: a.rankSlug,
            ["title"]: a.title,
          }));
          resolve(userRanks);
        }
      );
      // Ranks were passed in meaning we are looking for nested ranks
    } else {
      db.query(
        `SELECT rankSlug FROM rankRanks WHERE FIND_IN_SET(parentRankSlug, ?)`,
        [userRanks.join()],
        async function (err, results) {
          if (err) {
            throw err;
          }

          let childRanks = results.map((a) => a.rankSlug);
          let allRanks = userRanks.concat(childRanks);
          // Using a set of the array removes duplicates and prevents infinite loops
          let removeDuplicates = [...new Set(allRanks)];

          // If after removing duplicates the length of the new list is not longer than the old list we are done simply resolve
          if (userRanks.length <= removeDuplicates.length) {
            resolve(removeDuplicates);
          } else {
            resolve(getUserRanks(userData, removeDuplicates));
          }
        }
      );
    }
  });
}

export async function checkPermissions(username, permissionNode) {
  try {
    const userPermissions = await getUserPermissions(username);
    const hasPermission = userPermissions.includes(permissionNode);

    return hasPermission;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

export async function getUserLastSession(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM gameSessions WHERE userId=? ORDER BY sessionStart DESC LIMIT 1;`,
      [userId],
      async function (err, results) {
        if (err) {
          return reject(err);
        }

        if (results.length === 0) {
          // Return a default value if no session is found
          const defaultSessionData = {
            sessionStart: null,
            sessionEnd: null,
            server: null,
            lastOnlineDiff: null,
            isOnline: false,
          };
          return resolve(defaultSessionData);
        }

        const sessionRecord = results[0];
        const now = new Date();
        let isOnline = !sessionRecord.sessionEnd;

        // Treat stale sessions without an end time as offline after a grace period
        if (isOnline && sessionRecord.sessionStart) {
          const sessionStartDate = new Date(sessionRecord.sessionStart);
          const activeSeconds = Math.floor((now - sessionStartDate) / 1000);
          const staleThresholdSeconds = 24 * 60 * 60; // 24 hours
          if (activeSeconds > staleThresholdSeconds) {
            isOnline = false;
          }
        }

        const lastActivityDate = sessionRecord.sessionEnd
          ? new Date(sessionRecord.sessionEnd)
          : sessionRecord.sessionStart
          ? new Date(sessionRecord.sessionStart)
          : null;

        const sessionDiff = lastActivityDate
          ? convertSecondsToDuration(
              Math.max(0, Math.floor((now - lastActivityDate) / 1000))
            )
          : null;

        const sessionData = {
          sessionStart: sessionRecord.sessionStart,
          sessionEnd: sessionRecord.sessionEnd,
          server: sessionRecord.server,
          lastOnlineDiff: sessionDiff,
          isOnline,
        };

        resolve(sessionData);
      }
    );
  });
}

export async function linkDiscordAccount(userId, discordId, discordHandle = null) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET discordId=?, social_discord=? WHERE userId=?`,
      [discordId, discordHandle, userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

export async function unlinkDiscordAccount(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET discordId=NULL, social_discord=NULL WHERE userId=?`,
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
