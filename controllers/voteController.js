/**
 * voteController.js
 *
 * All database operations for the Voting & Reward system.
 * Keeps business logic out of route handlers.
 */

import crypto from "crypto";
import db from "./databaseController.js";

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      return resolve(results);
    });
  });
}

/**
 * Derive a YYYY-MM string from a Date or ISO string (always UTC).
 */
export function monthKeyFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Normalise a service name to lowercase, trimmed.
 */
export function normaliseServiceName(name) {
  if (typeof name !== "string") return "";
  return name.trim().toLowerCase();
}

/**
 * Build a deduplication key for a vote delivery.
 * SHA-256 of "<uuid>|<serviceName>|<YYYY-MM-DD>" (UTC date).
 */
export function buildVoteDedupeKey(playerUuid, serviceName, receivedAt) {
  const d = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
  const datePart = d.toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `${playerUuid.toLowerCase()}|${normaliseServiceName(serviceName)}|${datePart}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Build a deduplication key for a queue entry.
 * SHA-256 of "<uuid>|<source>|<commandText>".
 */
export function buildQueueDedupeKey(playerUuid, source, commandText) {
  const raw = `${playerUuid.toLowerCase()}|${source}|${commandText}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Vote Sites
// ---------------------------------------------------------------------------

export async function getAllVoteSites({ activeOnly = false } = {}) {
  let sql = "SELECT * FROM vote_sites";
  const params = [];
  if (activeOnly) {
    sql += " WHERE is_active = 1";
  }
  sql += " ORDER BY display_order ASC, id ASC";
  return query(sql, params);
}

export async function getVoteSiteById(id) {
  const rows = await query("SELECT * FROM vote_sites WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function getVoteSiteByServiceName(serviceName) {
  const rows = await query(
    "SELECT * FROM vote_sites WHERE service_name = ?",
    [normaliseServiceName(serviceName)]
  );
  return rows[0] || null;
}

export async function createVoteSite({ siteName, serviceName, voteUrl, isActive = true, displayOrder = 0 }) {
  const result = await query(
    `INSERT INTO vote_sites (site_name, service_name, vote_url, is_active, display_order)
     VALUES (?, ?, ?, ?, ?)`,
    [siteName, normaliseServiceName(serviceName), voteUrl, isActive ? 1 : 0, displayOrder]
  );
  return result.insertId;
}

export async function updateVoteSite(id, { siteName, serviceName, voteUrl, isActive, displayOrder }) {
  const fields = [];
  const params = [];

  if (siteName !== undefined) { fields.push("site_name = ?"); params.push(siteName); }
  if (serviceName !== undefined) { fields.push("service_name = ?"); params.push(normaliseServiceName(serviceName)); }
  if (voteUrl !== undefined) { fields.push("vote_url = ?"); params.push(voteUrl); }
  if (isActive !== undefined) { fields.push("is_active = ?"); params.push(isActive ? 1 : 0); }
  if (displayOrder !== undefined) { fields.push("display_order = ?"); params.push(displayOrder); }

  if (!fields.length) return false;

  params.push(id);
  await query(`UPDATE vote_sites SET ${fields.join(", ")} WHERE id = ?`, params);
  return true;
}

export async function deleteVoteSite(id) {
  const result = await query("DELETE FROM vote_sites WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// Vote Ingest
// ---------------------------------------------------------------------------

/**
 * Record a verified, deduplicated vote.
 *
 * @param {object} opts
 * @param {number}  opts.voteSiteId
 * @param {string}  opts.playerUuid
 * @param {string}  opts.playerName
 * @param {string}  opts.serviceName   (already normalised)
 * @param {string}  [opts.receivedFrom]
 * @param {Date}    opts.receivedAt
 * @returns {number} Inserted vote id.
 */
export async function recordVote({ voteSiteId, playerUuid, playerName, serviceName, receivedFrom, receivedAt }) {
  const monthKey = monthKeyFromDate(receivedAt);
  const dedupeKey = buildVoteDedupeKey(playerUuid, serviceName, receivedAt);

  const result = await query(
    `INSERT INTO votes
       (vote_site_id, player_uuid, player_name, service_name, received_from, received_at, month_key, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [voteSiteId, playerUuid, playerName, serviceName, receivedFrom || null, receivedAt, monthKey, dedupeKey]
  );
  return result.insertId;
}

/**
 * Upsert the player's monthly vote total (atomic increment).
 */
export async function upsertMonthlyTotal({ playerUuid, playerName, monthKey, voteAt }) {
  await query(
    `INSERT INTO vote_monthly_totals (player_uuid, player_name, month_key, vote_count, last_vote_at)
     VALUES (?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       vote_count   = vote_count + 1,
       player_name  = VALUES(player_name),
       last_vote_at = VALUES(last_vote_at)`,
    [playerUuid, playerName, monthKey, voteAt]
  );
}

// ---------------------------------------------------------------------------
// Command Queue
// ---------------------------------------------------------------------------

/**
 * Insert one or more reward commands into the queue.
 * Silently skips entries with duplicate dedupe_key values.
 *
 * @param {Array<{playerUuid, playerName, source, commandText, executeAs, serverScope, dedupeKey, availableAt}>} entries
 */
export async function enqueueCommands(entries) {
  if (!entries || !entries.length) return;

  for (const e of entries) {
    try {
      await query(
        `INSERT IGNORE INTO player_command_queue
           (player_uuid, player_name, source, command_text, execute_as, server_scope, dedupe_key, available_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.playerUuid,
          e.playerName,
          e.source,
          e.commandText,
          e.executeAs || "console",
          e.serverScope || "any",
          e.dedupeKey,
          e.availableAt || new Date(),
        ]
      );
    } catch (err) {
      // Duplicate key: already queued. Safe to skip.
      if (err.code !== "ER_DUP_ENTRY") throw err;
    }
  }
}

/**
 * Atomically claim pending commands for a player on a given server.
 * Returns the rows that were just claimed.
 *
 * Tie-safe: uses a SELECT … FOR UPDATE then UPDATE to avoid races on
 * multi-server Paper networks.
 */
export async function claimCommands({ playerUuid, serverName }) {
  return new Promise((resolve, reject) => {
    db.getConnection((connErr, conn) => {
      if (connErr) return reject(connErr);

      conn.beginTransaction(async (txErr) => {
        if (txErr) { conn.release(); return reject(txErr); }

        try {
          // Find matching pending rows and lock them.
          const [rows] = await new Promise((res, rej) => {
            conn.query(
              `SELECT id FROM player_command_queue
               WHERE player_uuid = ?
                 AND status = 'pending'
                 AND (server_scope = 'any' OR server_scope = ?)
                 AND available_at <= NOW()
               FOR UPDATE`,
              [playerUuid, serverName],
              (e, r) => { if (e) return rej(e); res([r]); }
            );
          });

          if (!rows || !rows.length) {
            conn.commit(() => { conn.release(); resolve([]); });
            return;
          }

          const ids = rows.map((r) => r.id);
          const placeholders = ids.map(() => "?").join(",");

          // Mark as claimed.
          await new Promise((res, rej) => {
            conn.query(
              `UPDATE player_command_queue
               SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
               WHERE id IN (${placeholders})`,
              ids,
              (e) => { if (e) return rej(e); res(); }
            );
          });

          // Fetch the full rows to return.
          const claimed = await new Promise((res, rej) => {
            conn.query(
              `SELECT * FROM player_command_queue WHERE id IN (${placeholders})`,
              ids,
              (e, r) => { if (e) return rej(e); res(r); }
            );
          });

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) return reject(commitErr);
            resolve(claimed);
          });
        } catch (err) {
          conn.rollback(() => { conn.release(); reject(err); });
        }
      });
    });
  });
}

/**
 * Mark commands as completed.
 * Only updates rows that belong to the given player to prevent cross-player tampering.
 */
export async function completeCommands(playerUuid, ids) {
  if (!ids || !ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  await query(
    `UPDATE player_command_queue
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id IN (${placeholders}) AND player_uuid = ?`,
    [...ids, playerUuid]
  );
}

/**
 * Mark commands as failed with a reason.
 * Only updates rows that belong to the given player.
 *
 * @param {string} playerUuid
 * @param {Array<{id: number, reason: string}>} failed
 */
export async function failCommands(playerUuid, failed) {
  if (!failed || !failed.length) return;
  for (const { id, reason } of failed) {
    await query(
      `UPDATE player_command_queue
       SET status = 'failed', failure_reason = ?, updated_at = NOW()
       WHERE id = ? AND player_uuid = ?`,
      [reason || null, id, playerUuid]
    );
  }
}

/**
 * Return the full queue (admin use).  Supports optional status/uuid filters.
 */
export async function getQueue({ status, playerUuid, limit = 100, offset = 0 } = {}) {
  const filters = [];
  const params = [];

  if (status) { filters.push("status = ?"); params.push(status); }
  if (playerUuid) { filters.push("player_uuid = ?"); params.push(playerUuid); }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  params.push(limit, offset);

  return query(
    `SELECT * FROM player_command_queue ${where}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    params
  );
}

// ---------------------------------------------------------------------------
// Leaderboard / Stats
// ---------------------------------------------------------------------------

export async function getLeaderboard({ monthKey, limit = 25 }) {
  return query(
    `SELECT player_uuid, player_name, vote_count, last_vote_at
     FROM vote_monthly_totals
     WHERE month_key = ?
     ORDER BY vote_count DESC, last_vote_at ASC
     LIMIT ?`,
    [monthKey, limit]
  );
}

export async function getPlayerMonthlyStats({ playerUuid, monthKey }) {
  const rows = await query(
    `SELECT * FROM vote_monthly_totals WHERE player_uuid = ? AND month_key = ?`,
    [playerUuid, monthKey]
  );
  return rows[0] || null;
}

export async function getVoteHistory({ playerUuid, monthKey, limit = 50 } = {}) {
  const filters = [];
  const params = [];

  if (playerUuid) { filters.push("player_uuid = ?"); params.push(playerUuid); }
  if (monthKey) { filters.push("month_key = ?"); params.push(monthKey); }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  params.push(limit);

  return query(
    `SELECT v.*, vs.site_name FROM votes v
     JOIN vote_sites vs ON vs.id = v.vote_site_id
     ${where}
     ORDER BY v.received_at DESC LIMIT ?`,
    params
  );
}

// ---------------------------------------------------------------------------
// Monthly Reward Processing
// ---------------------------------------------------------------------------

/**
 * Return the top voters for the given month_key.
 *
 * Tie rule: ALL players sharing the highest vote count are rewarded.
 * Within a tie group they are ordered by last_vote_at ASC (earliest final
 * vote wins positional priority, though all receive the same reward).
 *
 * @param {string} monthKey  YYYY-MM
 * @returns {Array} winner rows from vote_monthly_totals
 */
export async function getMonthlyWinners(monthKey) {
  // Find the highest vote count for the month.
  const topRows = await query(
    `SELECT MAX(vote_count) AS max_count FROM vote_monthly_totals WHERE month_key = ?`,
    [monthKey]
  );

  const maxCount = topRows[0]?.max_count;
  if (!maxCount) return [];

  return query(
    `SELECT player_uuid, player_name, vote_count, last_vote_at
     FROM vote_monthly_totals
     WHERE month_key = ? AND vote_count = ?
     ORDER BY last_vote_at ASC`,
    [monthKey, maxCount]
  );
}

/**
 * Check whether monthly rewards have already been generated for a given month.
 */
export async function monthlyRewardsAlreadyGenerated(monthKey) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM vote_monthly_results WHERE month_key = ?`,
    [monthKey]
  );
  return rows[0].cnt > 0;
}

/**
 * Record the monthly result entries (idempotent per month_key + player_uuid).
 */
export async function recordMonthlyResults(monthKey, winners) {
  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    await query(
      `INSERT IGNORE INTO vote_monthly_results (month_key, player_uuid, player_name, vote_count, tie_position)
       VALUES (?, ?, ?, ?, ?)`,
      [monthKey, w.player_uuid, w.player_name, w.vote_count, i + 1]
    );
  }
}

export async function getMonthlyResults({ monthKey } = {}) {
  const filters = monthKey ? "WHERE month_key = ?" : "";
  const params = monthKey ? [monthKey] : [];
  return query(
    `SELECT * FROM vote_monthly_results ${filters} ORDER BY month_key DESC, tie_position ASC`,
    params
  );
}
