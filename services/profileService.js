import db, { luckpermsDb } from "../controllers/databaseController.js";
import { UserGetter } from "../controllers/userController.js";

const RANK_VIEW = "ranks";
const USER_RANKS_VIEW = "userRanks";
const LUCKPERMS_PLAYERS_TABLE = "luckperms_players";

function mapRankRow(row) {
  const priority =
    row.priority !== null && row.priority !== undefined && row.priority !== ""
      ? Number(row.priority)
      : null;

  const isStaff =
    row.isStaff !== null && row.isStaff !== undefined && row.isStaff !== ""
      ? Number(row.isStaff)
      : 0;
  const isDonator =
    row.isDonator !== null && row.isDonator !== undefined && row.isDonator !== ""
      ? Number(row.isDonator)
      : 0;

  return {
    rankSlug: row.rankSlug,
    displayName: row.displayName || row.rankSlug,
    priority,
    rankBadgeColour: row.rankBadgeColour || null,
    rankTextColour: row.rankTextColour || null,
    discordRoleId: row.discordRoleId || null,
    isStaff,
    isDonator,
    title: row.title || null,
  };
}

/**
 * Get user data by username
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
export function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM users WHERE username = ?`,
      [username],
      (error, results) => {
        if (error) {
          console.error("[PROFILE SERVICE] Error fetching user:", error);
          return reject(error);
        }
        resolve(results?.[0] || null);
      }
    );
  });
}

/**
 * Get user ranks by username
 * @param {string} username
 * @returns {Promise<Array>}
 */
export async function getUserRanks(username) {
  if (!username) {
    return [];
  }

  try {
    // First get the user's UUID
    const [webUser] = await new Promise((resolve, reject) => {
      db.query(
        `SELECT userId, username, uuid FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username.trim()],
        (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        }
      );
    });

    const [luckPermsUser] = await new Promise((resolve, reject) => {
      luckpermsDb.query(
        `SELECT username, LOWER(HEX(uuid)) AS uuid FROM ${LUCKPERMS_PLAYERS_TABLE} WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username.trim()],
        (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        }
      );
    });

    const uuid = webUser?.uuid || luckPermsUser?.uuid;
    if (!uuid) {
      return [];
    }

    // Get ranks for this UUID
    const rows = await new Promise((resolve, reject) => {
      db.query(
        `SELECT
            r.rankSlug,
            r.displayName,
            r.priority,
            r.rankBadgeColour,
            r.rankTextColour,
            r.discordRoleId,
            r.isStaff,
            r.isDonator,
            ur.title
          FROM ${USER_RANKS_VIEW} ur
            JOIN ${RANK_VIEW} r ON ur.rankSlug = r.rankSlug
          WHERE ur.uuid = ?
          ORDER BY CAST(COALESCE(r.priority, 0) AS UNSIGNED) DESC, r.rankSlug`,
        [uuid],
        (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        }
      );
    });

    return rows.map((row) => mapRankRow(row));
  } catch (error) {
    console.error("[PROFILE SERVICE] Failed to fetch ranks for", username, error);
    return [];
  }
}

/**
 * Get reports by reporter ID
 * @param {number} reporterId
 * @returns {Promise<{success: boolean, data?: Array, message?: string}>}
 */
export function getReportsByReporterId(reporterId) {
  return new Promise((resolve) => {
    db.query(
      `SELECT * FROM reports WHERE reporterId = ?`,
      [reporterId],
      (error, results) => {
        if (error) {
          console.error("[PROFILE SERVICE] Error fetching reports:", error);
          return resolve({ success: false, message: `${error}` });
        }
        if (!results || !results.length) {
          return resolve({ success: false, message: "There are no reports available." });
        }
        resolve({ success: true, data: results });
      }
    );
  });
}

/**
 * Get punishments for a user by username
 * @param {string} username
 * @returns {Promise<{success: boolean, data?: Array, message?: string}>}
 */
export async function getUserPunishments(username) {
  try {
    const userGetter = new UserGetter();
    const userRecord = await userGetter.byUsername(username);

    if (!userRecord?.uuid) {
      return { success: false, message: "User not found." };
    }

    const punishments = await new Promise((resolve, reject) => {
      db.query(
        `SELECT p.*, banner.username AS bannedByUsername, remover.username AS removedByUsername
         FROM punishments p
         LEFT JOIN users banner ON p.bannedByUserId = banner.userId
         LEFT JOIN users remover ON p.removedByUserId = remover.userId
         WHERE p.bannedUuid = ?
         ORDER BY p.dateStart DESC
         LIMIT 50`,
        [userRecord.uuid],
        (error, results) => {
          if (error) return reject(error);
          resolve(results || []);
        }
      );
    });

    return {
      success: true,
      data: punishments,
      target: {
        username: userRecord.username,
        uuid: userRecord.uuid,
        userId: userRecord.userId,
      },
    };
  } catch (error) {
    console.error("[PROFILE SERVICE] Failed to fetch punishments:", error);
    return { success: false, message: `${error}` };
  }
}
