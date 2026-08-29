import crypto from "crypto";
import db from "./databaseController.js";

/**
 * Data-access layer for Crafting For Christ Wrapped.
 *
 * Raw SQL via the mysql2 pool shim, matching the convention of the other
 * controllers in this repo. Two concerns live here:
 *   1. Zander's own per-user stats for a Wrapped period (gameSessions).
 *   2. Persistence of computed Wrapped payloads + the per-period leaderboard
 *      cache (see 0033_wrapped migration).
 *
 * All orchestration (calling MineMonitor, merging, ranking, deriving slides)
 * lives in services/wrapped/wrappedService.js.
 */

function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

export function generateShareId() {
  // URL-safe, 22 chars (~128 bits).
  return crypto.randomBytes(16).toString("base64url").slice(0, 22);
}

// ── Zander-side stats ──────────────────────────────────────────────────────

/**
 * Period-scoped playtime + session metrics plus lifetime tenure for one user.
 * Session time is clamped to [start, end] so a session straddling the window
 * boundary only contributes its in-window portion.
 */
export async function getZanderStatsForUser(userId, start, end) {
  const [agg] = await q(
    `SELECT
        COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(
          LEAST(COALESCE(sessionEnd, NOW()), ?), GREATEST(sessionStart, ?)
        ))), 0) AS seconds,
        COUNT(*) AS sessions
      FROM gameSessions
      WHERE userId = ?
        AND sessionStart <= ?
        AND COALESCE(sessionEnd, NOW()) >= ?`,
    [end, start, userId, end, start]
  );

  const [firstRow] = await q(
    `SELECT MIN(sessionStart) AS firstSeen FROM gameSessions WHERE userId = ?`,
    [userId]
  );
  const [userRow] = await q(`SELECT joined FROM users WHERE userId = ? LIMIT 1`, [userId]);

  const [dayRow] = await q(
    `SELECT DATE(sessionStart) AS bucket,
            SUM(TIME_TO_SEC(TIMEDIFF(COALESCE(sessionEnd, NOW()), sessionStart))) AS seconds
       FROM gameSessions
      WHERE userId = ? AND sessionStart BETWEEN ? AND ?
      GROUP BY bucket ORDER BY seconds DESC LIMIT 1`,
    [userId, start, end]
  );

  const [monthRow] = await q(
    `SELECT DATE_FORMAT(sessionStart, '%Y-%m') AS bucket,
            SUM(TIME_TO_SEC(TIMEDIFF(COALESCE(sessionEnd, NOW()), sessionStart))) AS seconds
       FROM gameSessions
      WHERE userId = ? AND sessionStart BETWEEN ? AND ?
      GROUP BY bucket ORDER BY seconds DESC LIMIT 1`,
    [userId, start, end]
  );

  const seconds = Number(agg?.seconds) || 0;
  const sessions = Number(agg?.sessions) || 0;
  const firstSeen = firstRow?.firstSeen || userRow?.joined || null;

  return {
    playtimeSeconds: seconds,
    sessions,
    avgSessionSeconds: sessions > 0 ? Math.round(seconds / sessions) : 0,
    firstSeen: firstSeen ? new Date(firstSeen).toISOString() : null,
    tenureDays: firstSeen
      ? Math.max(0, Math.floor((Date.now() - new Date(firstSeen).getTime()) / 86400000))
      : null,
    mostActiveDay: dayRow
      ? { date: String(dayRow.bucket).slice(0, 10), seconds: Number(dayRow.seconds) || 0 }
      : null,
    mostActiveMonth: monthRow
      ? { month: String(monthRow.bucket), seconds: Number(monthRow.seconds) || 0 }
      : null,
  };
}

/**
 * All users eligible for Wrapped ranking: a real (linked) Minecraft account,
 * not a placeholder, not disabled.
 */
export async function getLinkedUsers() {
  return q(
    `SELECT userId, username, uuid
       FROM users
      WHERE uuid IS NOT NULL AND uuid <> ''
        AND is_placeholder = 0
        AND account_disabled = 0`
  );
}

/**
 * One grouped query: period-scoped playtime seconds + session count for every
 * user. Feeds the leaderboard cache so per-user builds don't re-scan.
 * @returns {Promise<Map<number, { playtimeSeconds: number, sessions: number }>>}
 */
export async function getZanderLeaderboardRaw(start, end) {
  const rows = await q(
    `SELECT userId,
            COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(
              LEAST(COALESCE(sessionEnd, NOW()), ?), GREATEST(sessionStart, ?)
            ))), 0) AS seconds,
            COUNT(*) AS sessions
       FROM gameSessions
      WHERE sessionStart <= ? AND COALESCE(sessionEnd, NOW()) >= ?
      GROUP BY userId`,
    [end, start, end, start]
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.userId), {
      playtimeSeconds: Number(r.seconds) || 0,
      sessions: Number(r.sessions) || 0,
    });
  }
  return map;
}

// ── Persisted runs ────────────────────────────────────────────────────────

export async function getWrappedRun(userId, periodYear) {
  const [row] = await q(
    `SELECT * FROM wrappedRuns WHERE userId = ? AND periodYear = ? LIMIT 1`,
    [userId, periodYear]
  );
  return row ? hydrateRun(row) : null;
}

export async function getWrappedRunByShareId(shareId) {
  const [row] = await q(`SELECT * FROM wrappedRuns WHERE shareId = ? LIMIT 1`, [shareId]);
  return row ? hydrateRun(row) : null;
}

export async function upsertWrappedRun({ userId, periodYear, periodStart, periodEnd, shareId, payload, force = false }) {
  const json = JSON.stringify(payload);
  // First write wins — a generated run is immutable. `force` is the only path
  // that overwrites an existing payload (admin regenerate).
  const onDup = force
    ? `ON DUPLICATE KEY UPDATE periodStart = VALUES(periodStart), periodEnd = VALUES(periodEnd), payload = VALUES(payload)`
    : `ON DUPLICATE KEY UPDATE runId = runId`;
  await q(
    `INSERT INTO wrappedRuns (userId, periodYear, periodStart, periodEnd, shareId, payload)
       VALUES (?, ?, ?, ?, ?, ?)
     ${onDup}`,
    [userId, periodYear, periodStart, periodEnd, shareId, json]
  );
  return getWrappedRun(userId, periodYear);
}

export async function markWrappedViewed(userId, periodYear) {
  await q(
    `UPDATE wrappedRuns SET viewedAt = NOW()
      WHERE userId = ? AND periodYear = ? AND viewedAt IS NULL`,
    [userId, periodYear]
  );
}

/** Most recent runs for a period — for the admin dashboard listing. */
export async function listWrappedRuns(periodYear, limit = 25) {
  const rows = await q(
    `SELECT w.runId, w.userId, w.shareId, w.createdAt, w.viewedAt, u.username
       FROM wrappedRuns w
       LEFT JOIN users u ON u.userId = w.userId
      WHERE w.periodYear = ?
      ORDER BY w.createdAt DESC
      LIMIT ?`,
    [periodYear, Number(limit) || 25]
  );
  return rows.map((r) => ({
    runId: r.runId,
    userId: r.userId,
    username: r.username || `#${r.userId}`,
    shareId: r.shareId,
    createdAt: r.createdAt,
    viewedAt: r.viewedAt,
  }));
}

// ── Editable period settings (singleton row, id = 1) ──────────────────────

export async function getWrappedSettings() {
  const [row] = await q(`SELECT enabled, periodStart, periodEnd FROM wrappedSettings WHERE id = 1`);
  return {
    enabled: row && row.enabled !== null ? Boolean(row.enabled) : null,
    periodStart: row?.periodStart ?? null,
    periodEnd: row?.periodEnd ?? null,
  };
}

export async function saveWrappedSettings({ enabled, periodStart, periodEnd }) {
  await q(
    `INSERT INTO wrappedSettings (id, enabled, periodStart, periodEnd)
       VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       periodStart = VALUES(periodStart),
       periodEnd = VALUES(periodEnd)`,
    [
      enabled === null || enabled === undefined ? null : enabled ? 1 : 0,
      periodStart ?? null,
      periodEnd ?? null,
    ]
  );
  return getWrappedSettings();
}

/** Has this user already generated (and thus been prompted for) this period? */
export async function hasWrappedRun(userId, periodYear) {
  const [row] = await q(
    `SELECT 1 AS x FROM wrappedRuns WHERE userId = ? AND periodYear = ? LIMIT 1`,
    [userId, periodYear]
  );
  return Boolean(row);
}

function hydrateRun(row) {
  return {
    runId: row.runId,
    userId: row.userId,
    periodYear: row.periodYear,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    shareId: row.shareId,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    createdAt: row.createdAt,
    viewedAt: row.viewedAt,
  };
}

// ── Leaderboard cache ─────────────────────────────────────────────────────

export async function readLeaderboardCache(periodYear, maxAgeMs = 6 * 60 * 60 * 1000) {
  const [row] = await q(
    `SELECT computedAt, data FROM wrappedLeaderboardCache WHERE periodYear = ? LIMIT 1`,
    [periodYear]
  );
  if (!row) return null;
  const age = Date.now() - new Date(row.computedAt).getTime();
  if (age > maxAgeMs) return null;
  return {
    computedAt: row.computedAt,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  };
}

export async function writeLeaderboardCache(periodYear, data) {
  await q(
    `INSERT INTO wrappedLeaderboardCache (periodYear, data)
       VALUES (?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data), computedAt = NOW()`,
    [periodYear, JSON.stringify(data)]
  );
}
