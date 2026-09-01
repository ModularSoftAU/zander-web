/**
 * services/mixed/entitlements.js
 *
 * Player ranks and entitlements sync state (mixed_player_ranks / _entitlements).
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q, isValidUuid, normaliseUuid } from "./_shared.js";

export async function syncPlayerRank({ uuid, username, rankKey, expiresAt }) {
  await q(
    `INSERT INTO mixed_ranks (rank_key, display_name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE display_name = display_name`,
    [rankKey, rankKey]
  );
  await q(
    `INSERT INTO mixed_player_ranks (player_uuid, username, rank_key, expires_at, sync_status, synced_at)
     VALUES (?, ?, ?, ?, 'synced', NOW())
     ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), username = VALUES(username),
       sync_status = 'synced', synced_at = NOW()`,
    [uuid, username || null, rankKey, expiresAt || null]
  );
}

export async function listPlayerRanks({ search, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (search) {
    if (isValidUuid(search)) { where.push(`pr.player_uuid = ?`); params.push(normaliseUuid(search)); }
    else { where.push(`pr.username LIKE ?`); params.push(`%${search}%`); }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return q(
    `SELECT pr.*, r.display_name FROM mixed_player_ranks pr
       LEFT JOIN mixed_ranks r ON r.rank_key = pr.rank_key ${whereSql}
      ORDER BY pr.updated_at DESC LIMIT ?`, [...params, limit]
  );
}

export async function expiringRanks(days = 7) {
  return q(
    `SELECT pr.*, r.display_name FROM mixed_player_ranks pr
       LEFT JOIN mixed_ranks r ON r.rank_key = pr.rank_key
      WHERE pr.expires_at IS NOT NULL AND pr.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
      ORDER BY pr.expires_at ASC`, [days]
  );
}

export async function markRankPendingSync(uuid) {
  await q(`UPDATE mixed_player_ranks SET sync_status = 'pending' WHERE player_uuid = ?`, [uuid]);
}

export async function getPlayerEntitlements(uuid) {
  return q(
    `SELECT pe.*, e.display_name, e.description FROM mixed_player_entitlements pe
       LEFT JOIN mixed_entitlements e ON e.entitlement_key = pe.entitlement_key
      WHERE pe.player_uuid = ? ORDER BY pe.created_at DESC`, [uuid]
  );
}

export async function addEntitlement({ uuid, username, entitlementKey, expiresAt }) {
  await q(
    `INSERT INTO mixed_entitlements (entitlement_key, display_name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE display_name = display_name`,
    [entitlementKey, entitlementKey]
  );
  await q(
    `INSERT INTO mixed_player_entitlements (player_uuid, username, entitlement_key, expires_at, sync_status)
     VALUES (?, ?, ?, ?, 'pending')
     ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), sync_status = 'pending'`,
    [uuid, username || null, entitlementKey, expiresAt || null]
  );
}

export async function removeEntitlement(uuid, entitlementId) {
  await q(`DELETE FROM mixed_player_entitlements WHERE id = ? AND player_uuid = ?`, [entitlementId, uuid]);
}

export async function markEntitlementsSynced(uuid) {
  await q(`UPDATE mixed_player_entitlements SET sync_status = 'synced', synced_at = NOW() WHERE player_uuid = ?`, [uuid]);
}

