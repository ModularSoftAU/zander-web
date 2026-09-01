/**
 * services/user/stats.js
 *
 * Playtime / login stats, the seconds->duration formatter, and last-session lookup.
 *
 * Extracted from controllers/userController.js (Phase 7 decomposition).
 * Re-exported by the controllers/userController.js barrel.
 */

import db from "../../controllers/databaseController.js";

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

  const s = Math.max(0, Number(seconds) || 0);

  if (s === 0) return "None yet";
  if (s < MINUTE) return `${s} seconds`;
  if (s < HOUR) return `${Math.floor(s / MINUTE)} minutes`;
  if (s < DAY) return `${Math.floor(s / HOUR)} hours`;
  if (s < MONTH) return `${Math.floor(s / DAY)} days`;
  return `${Math.floor(s / MONTH)} months`;
}

export async function getUserLastSession(userId, { includeHidden = false } = {}) {
  // Hidden sessions belong to a currently-vanished player. For every public
  // presence surface the vanished player must look exactly like an offline one,
  // so we resolve against their most recent *visible* session instead. Staff
  // tooling can opt back in with { includeHidden: true }.
  const hiddenFilter = includeHidden ? "" : "AND hidden = 0 ";

  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM gameSessions WHERE userId=? ${hiddenFilter}ORDER BY sessionStart DESC LIMIT 1;`,
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

