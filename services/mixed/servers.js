/**
 * services/mixed/servers.js
 *
 * Server heartbeats / online state (mixed_servers) and the match-row stub used by heartbeats.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q, one, toJson, parseJson } from "./_shared.js";
import { upsertPlaceholderMap } from "./maps.js";

export async function upsertServerHeartbeat(data) {
  const serverId = data.server_id || data.serverId;
  const displayName = data.display_name || data.displayName || serverId;
  const environment = data.environment || "production";
  const currentMatchId = data.current_match_id || data.currentMatchId || null;
  const currentMapKey = data.current_map_key || data.currentMapKey || null;
  const currentMapName = data.current_map_name || data.currentMapName || null;
  const playerCount = data.player_count ?? data.playerCount ?? data.onlinePlayers ?? 0;
  const tps = data.tps ?? null;
  const pgmVersion = data.pgm_version || data.pgmVersion || null;
  const zanderPgmVersion = data.zander_pgm_version || data.zanderPgmVersion || null;

  await q(
    `INSERT INTO mixed_servers
       (server_id, display_name, environment, online, current_match_id,
        current_map_key, current_map_name, player_count, tps, pgm_version,
        zander_pgm_version, last_heartbeat_at, metadata)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       environment = VALUES(environment),
       online = 1,
       current_match_id = VALUES(current_match_id),
       current_map_key = VALUES(current_map_key),
       current_map_name = VALUES(current_map_name),
       player_count = VALUES(player_count),
       tps = VALUES(tps),
       pgm_version = VALUES(pgm_version),
       zander_pgm_version = VALUES(zander_pgm_version),
       last_heartbeat_at = NOW(),
       metadata = VALUES(metadata)`,
    [
      serverId, displayName,
      environment, currentMatchId,
      currentMapKey, currentMapName,
      playerCount, tps, pgmVersion,
      zanderPgmVersion, toJson(data.metadata),
    ]
  );

  // The plugin doesn't always call /api/mixed/stats/match on match start —
  // ensure rows exist so /mixed/live (INNER JOINs mixed_matches) and
  // /mixed/maps (reads mixed_maps) can find them. Never overwrites an
  // existing map/match row's data — this only fills gaps.
  if (currentMapKey) {
    await upsertPlaceholderMap(currentMapKey, { name: currentMapName });
  }
  if (currentMatchId) {
    await ensureMatchExists(currentMatchId, {
      serverId, mapKey: currentMapKey, mapName: currentMapName,
    });
  }

  return getServer(serverId);
}

export async function ensureMatchExists(matchId, { serverId, mapKey, mapName } = {}) {
  if (!matchId) return;
  await q(
    `INSERT INTO mixed_matches (match_id, server_id, map_key, map_name, status, started_at)
     VALUES (?, ?, ?, ?, 'running', NOW())
     ON DUPLICATE KEY UPDATE match_id = match_id`,
    [matchId, serverId || null, mapKey || null, mapName || null]
  );
}

export async function markServerOffline(serverId) {
  await q(
    `UPDATE mixed_servers SET online = 0, current_match_id = NULL WHERE server_id = ?`,
    [serverId]
  );
}

export async function getServer(serverId) {
  const row = await one(`SELECT * FROM mixed_servers WHERE server_id = ?`, [serverId]);
  if (row) row.metadata = parseJson(row.metadata);
  return row;
}

export async function listServers() {
  const rows = await q(`SELECT * FROM mixed_servers ORDER BY online DESC, display_name ASC`);
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

