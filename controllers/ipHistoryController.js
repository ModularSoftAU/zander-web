import db from "./databaseController.js";

export function recordIpSession(uuid, ipAddress) {
  return new Promise((resolve, reject) => {
    db.query(
      `
        INSERT INTO player_ip_history
            (uuid, ip_address, first_seen_at, last_seen_at, session_count)
        VALUES (?, ?, NOW(), NOW(), 1)
        ON DUPLICATE KEY UPDATE
            last_seen_at = NOW(),
            session_count = session_count + 1
      `,
      [uuid, ipAddress],
      function (error) {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export function getIpHistoryByUuid(uuid) {
  return new Promise((resolve, reject) => {
    db.query(
      `
        SELECT ip_address, first_seen_at, last_seen_at, session_count
        FROM player_ip_history
        WHERE uuid = ?
        ORDER BY last_seen_at DESC
      `,
      [uuid],
      function (error, results) {
        if (error) reject(error);
        else resolve(results);
      }
    );
  });
}

export function getAccountsByIp(ipAddress) {
  return new Promise((resolve, reject) => {
    db.query(
      `
        SELECT u.uuid, u.username, p.first_seen_at, p.last_seen_at, p.session_count
        FROM player_ip_history p
        JOIN users u ON u.uuid = p.uuid
        WHERE p.ip_address = ?
        ORDER BY p.last_seen_at DESC
      `,
      [ipAddress],
      function (error, results) {
        if (error) reject(error);
        else resolve(results);
      }
    );
  });
}

export function getCurrentStatus(uuid) {
  return new Promise((resolve, reject) => {
    db.query(
      `
        SELECT gs.server
        FROM gameSessions gs
        JOIN users u ON u.userId = gs.userId
        WHERE u.uuid = ?
          AND gs.sessionEnd IS NULL
        ORDER BY gs.sessionStart DESC
        LIMIT 1
      `,
      [uuid],
      function (error, results) {
        if (error) {
          reject(error);
          return;
        }
        if (!results || results.length === 0) {
          resolve({ online: false, server: null });
        } else {
          resolve({ online: true, server: results[0].server });
        }
      }
    );
  });
}
