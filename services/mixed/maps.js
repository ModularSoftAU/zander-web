/**
 * services/mixed/maps.js
 *
 * Map rows (mixed_maps): plugin + repo-sync upserts, public/admin reads, placeholder + conflict handling, and the GitHub repo sync-run log.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import {
  q, one, toJson, parseJson, firstNonEmptyString, normalisePeopleList,
  withDisplayFields, stripSourceInfo,
} from "./_shared.js";
import { getMapRatingTotals } from "./ratings.js";

export async function upsertMap(data) {
  await q(
    `INSERT INTO mixed_maps
       (map_key, name, version, gamemode, authors, description, thumbnail_url,
        tags, objectives, first_seen_at, last_played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       version = COALESCE(VALUES(version), version),
       gamemode = COALESCE(VALUES(gamemode), gamemode),
       authors = COALESCE(VALUES(authors), authors),
       objectives = COALESCE(VALUES(objectives), objectives)`,
    [
      data.map_key, data.name || data.map_key, data.version || null,
      data.gamemode || null, toJson(data.authors), data.description || null,
      data.thumbnail_url || null, toJson(data.tags), toJson(data.objectives),
      data.last_played_at || null,
    ]
  );
  return getMap(data.map_key);
}

export async function getMap(mapKey, { includeSourceInfo = false } = {}) {
  const row = await one(`SELECT * FROM mixed_maps WHERE map_key = ?`, [mapKey]);
  if (!row) return null;
  row.authors = parseJson(row.authors, []);
  row.contributors = parseJson(row.contributors, []);
  row.tags = parseJson(row.tags, []);
  row.gamemodes = parseJson(row.gamemodes, []);
  row.objectives = parseJson(row.objectives, []);
  row.teams_from_xml = parseJson(row.teams_from_xml, []);
  row.objectives_from_xml = parseJson(row.objectives_from_xml, []);
  row.rules_from_xml = parseJson(row.rules_from_xml, []);
  row.screenshots_from_repo = parseJson(row.screenshots_from_repo, []);
  row.inferred_tags = parseJson(row.inferred_tags, []);
  row.custom_tags = parseJson(row.custom_tags, []);
  const totals = await one(`SELECT * FROM mixed_map_totals WHERE map_key = ?`, [mapKey]);
  if (totals) totals.team_win_counts = parseJson(totals.team_win_counts, {});
  const ratings = await getMapRatingTotals(mapKey);
  let full = withDisplayFields({ ...row, totals: totals || null, ratingTotals: ratings });
  if (!includeSourceInfo) full = stripSourceInfo(full);
  return full;
}

export async function listMaps({
  search, gamemode, author, sourceKey, sort = "last_played", order = "desc",
  page = 1, limit = 24, includeHidden = false, includeSourceInfo = false,
} = {}) {
  const where = [];
  const params = [];
  if (!includeHidden) where.push(`m.public_visible = 1`);
  if (search) { where.push(`m.name LIKE ?`); params.push(`%${search}%`); }
  if (gamemode) { where.push(`m.gamemode = ?`); params.push(gamemode); }
  if (author) {
    where.push(`(
      JSON_SEARCH(m.authors, 'one', ?) IS NOT NULL
      OR JSON_SEARCH(m.contributors, 'one', ?) IS NOT NULL
    )`);
    params.push(author, author);
  }
  if (sourceKey && includeSourceInfo) { where.push(`m.source_key = ?`); params.push(sourceKey); }

  const sortMap = {
    times_played: "m.times_played",
    average_rating: "rt.average_overall",
    average_duration: "m.average_duration_seconds",
    last_played: "m.last_played_at",
    name: "m.name",
    gamemode: "m.gamemode",
    author: "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(m.authors, '$[0]')), JSON_UNQUOTE(JSON_EXTRACT(m.contributors, '$[0]')), '')",
  };
  const sortCol = sortMap[sort] || "m.last_played_at";
  const dir = order === "asc" ? "ASC" : "DESC";
  const offset = (Math.max(1, page) - 1) * limit;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await q(
    `SELECT m.*, rt.average_overall, rt.rating_count
       FROM mixed_maps m
       LEFT JOIN mixed_map_rating_totals rt ON rt.map_key = m.map_key
       ${whereSql}
       ORDER BY ${sortCol} ${dir}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRow = await one(
    `SELECT COUNT(*) AS total FROM mixed_maps m ${whereSql}`, params
  );
  return {
    maps: rows.map((r) => {
      let row = withDisplayFields({
        ...r,
        authors: parseJson(r.authors, []),
        tags: parseJson(r.tags, []),
        inferred_tags: parseJson(r.inferred_tags, []),
        custom_tags: parseJson(r.custom_tags, []),
      });
      if (!includeSourceInfo) row = stripSourceInfo(row);
      return row;
    }),
    total: totalRow?.total || 0,
    page: Math.max(1, page),
    limit,
  };
}

// ---------------------------------------------------------------------------
// Repo sync: upsert, placeholders, conflicts, runs/errors
// ---------------------------------------------------------------------------

/**
 * Upserts a map row from the GitHub repo sync. Distinct from upsertMap()
 * (used by plugin ingestion) so that admin-controlled fields
 * (public_visible, custom_*, voting_enabled, token_enabled, blacklisted_*)
 * are NEVER touched by a re-sync — only set on first insert.
 */
export async function upsertMapFromRepoSync(row) {
  await q(
    `INSERT INTO mixed_maps
       (map_key, name, version, gamemode, gamemodes, authors, contributors,
        description_from_xml, teams_from_xml, objectives_from_xml, rules_from_xml,
        thumbnail_from_repo, screenshots_from_repo, inferred_tags,
        source_key, source_display_name, source_org, source_repo, source_branch,
        source_path, source_commit, last_synced_at, last_sync_status, last_sync_error,
        discovered_from_server, first_seen_at,
        public_visible, voting_enabled, token_enabled,
        blacklisted_from_voting, blacklisted_from_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 0, NOW(),
             ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       version = VALUES(version),
       gamemode = VALUES(gamemode),
       gamemodes = VALUES(gamemodes),
       authors = VALUES(authors),
       contributors = VALUES(contributors),
       description_from_xml = VALUES(description_from_xml),
       teams_from_xml = VALUES(teams_from_xml),
       objectives_from_xml = VALUES(objectives_from_xml),
       rules_from_xml = VALUES(rules_from_xml),
       thumbnail_from_repo = VALUES(thumbnail_from_repo),
       screenshots_from_repo = VALUES(screenshots_from_repo),
       inferred_tags = VALUES(inferred_tags),
       source_key = VALUES(source_key),
       source_display_name = VALUES(source_display_name),
       source_org = VALUES(source_org),
       source_repo = VALUES(source_repo),
       source_branch = VALUES(source_branch),
       source_path = VALUES(source_path),
       source_commit = VALUES(source_commit),
       last_synced_at = NOW(),
       last_sync_status = VALUES(last_sync_status),
       last_sync_error = VALUES(last_sync_error)`,
    [
      row.map_key, row.name || row.map_key, row.version || null,
      row.gamemode || "Unknown", toJson(row.gamemodes || []),
      toJson(row.authors || []), toJson(row.contributors || []),
      row.description_from_xml || null, toJson(row.teams_from_xml || []),
      toJson(row.objectives_from_xml || []), toJson(row.rules_from_xml || []),
      row.thumbnail_from_repo || null, toJson(row.screenshots_from_repo || []),
      toJson(row.inferred_tags || []),
      row.source_key || null, row.source_display_name || null, row.source_org || null,
      row.source_repo || null, row.source_branch || null, row.source_path || null,
      row.source_commit || null, row.last_sync_status || "ok", row.last_sync_error || null,
      row.public_visible ?? 1, row.voting_enabled ?? 1, row.token_enabled ?? 1,
      row.blacklisted_from_voting ?? 0, row.blacklisted_from_tokens ?? 0,
    ]
  );
  return getMap(row.map_key, { includeSourceInfo: true });
}

export async function markMapSyncConflict(mapKey, message) {
  await q(
    `UPDATE mixed_maps SET last_sync_status = 'conflict', last_sync_error = ? WHERE map_key = ?`,
    [message, mapKey]
  );
}

/**
 * No-clobber placeholder insert used by plugin ingestion when a match
 * references a map_key not (yet) known to any synced repo. Never overwrites
 * an existing row (repo-synced or otherwise).
 */
export async function upsertPlaceholderMap(mapKey, { name, gamemode } = {}) {
  await q(
    `INSERT INTO mixed_maps
       (map_key, name, gamemode, source_key, discovered_from_server, first_seen_at,
        public_visible, voting_enabled, token_enabled)
     VALUES (?, ?, ?, 'server-discovered', 1, NOW(), 1, 0, 0)
     ON DUPLICATE KEY UPDATE map_key = map_key`,
    [mapKey, name || mapKey, gamemode || "Unknown"]
  );
  return getMap(mapKey);
}

export async function listDuplicateConflicts() {
  return q(`SELECT * FROM mixed_maps WHERE last_sync_status = 'conflict' ORDER BY last_synced_at DESC`);
}

export async function listPlaceholderMaps() {
  return q(`SELECT * FROM mixed_maps WHERE discovered_from_server = 1 ORDER BY first_seen_at DESC`);
}

// Deletes placeholder rows (discovered_from_server = 1) — junk left behind
// when a live match's map_key didn't match any synced repo map, often a
// duplicate of a map that later synced correctly under a different slug.
// Matches referencing the map_key keep their own map_name/map_key text
// (see getMatch/listMatches COALESCE), so this is safe: it just removes the
// standalone map-browser entry and its per-map aggregates, not match history.
export async function purgePlaceholderMaps({ mapKeys } = {}) {
  const rows = mapKeys?.length
    ? await q(`SELECT map_key FROM mixed_maps WHERE discovered_from_server = 1 AND map_key IN (${mapKeys.map(() => "?").join(",")})`, mapKeys)
    : await q(`SELECT map_key FROM mixed_maps WHERE discovered_from_server = 1`);
  const keys = rows.map((r) => r.map_key);
  if (!keys.length) return { deleted: 0, mapKeys: [] };

  const placeholders = keys.map(() => "?").join(",");
  await q(`DELETE FROM mixed_map_ratings WHERE map_key IN (${placeholders})`, keys);
  await q(`DELETE FROM mixed_map_rating_totals WHERE map_key IN (${placeholders})`, keys);
  await q(`DELETE FROM mixed_map_player_totals WHERE map_key IN (${placeholders})`, keys);
  await q(`DELETE FROM mixed_map_records WHERE map_key IN (${placeholders})`, keys);
  await q(`DELETE FROM mixed_map_totals WHERE map_key IN (${placeholders})`, keys);
  const result = await q(`DELETE FROM mixed_maps WHERE map_key IN (${placeholders}) AND discovered_from_server = 1`, keys);
  return { deleted: result.affectedRows || 0, mapKeys: keys };
}

export async function createSyncRun({ sourceKey, sourceDisplayName, sourceOrg, sourceRepo, sourceBranch, triggeredBy } = {}) {
  const res = await q(
    `INSERT INTO mixed_map_sync_runs
       (source_key, source_display_name, source_org, source_repo, source_branch,
        status, triggered_by, started_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?, NOW())`,
    [sourceKey || null, sourceDisplayName || null, sourceOrg || null, sourceRepo || null, sourceBranch || null, triggeredBy || null]
  );
  return res.insertId;
}

export async function finishSyncRun(runId, {
  status, sourceCommit, mapsFound = 0, mapsCreated = 0, mapsUpdated = 0,
  mapsSkipped = 0, conflictsFound = 0, errorMessage,
} = {}) {
  await q(
    `UPDATE mixed_map_sync_runs
        SET status = ?, source_commit = COALESCE(?, source_commit),
            maps_found = ?, maps_created = ?, maps_updated = ?, maps_skipped = ?,
            conflicts_found = ?, error_message = ?, finished_at = NOW()
      WHERE id = ?`,
    [status, sourceCommit || null, mapsFound, mapsCreated, mapsUpdated, mapsSkipped, conflictsFound, errorMessage || null, runId]
  );
}

export async function recordSyncError({ runId, sourceKey, sourceOrg, sourceRepo, mapKey, sourcePath, errorType, message }) {
  await q(
    `INSERT INTO mixed_map_sync_errors
       (sync_run_id, source_key, source_org, source_repo, map_key, source_path, error_type, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [runId, sourceKey || null, sourceOrg || null, sourceRepo || null, mapKey || null, sourcePath || null, errorType, message]
  );
}

export async function listSyncRuns({ sourceKey, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (sourceKey) { where.push(`source_key = ?`); params.push(sourceKey); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return q(
    `SELECT * FROM mixed_map_sync_runs ${whereSql} ORDER BY started_at DESC LIMIT ?`,
    [...params, limit]
  );
}

export async function getLatestSyncRunPerSource() {
  return q(
    `SELECT r.* FROM mixed_map_sync_runs r
       INNER JOIN (
         SELECT source_key, MAX(started_at) AS max_started
           FROM mixed_map_sync_runs WHERE source_key IS NOT NULL GROUP BY source_key
       ) latest ON latest.source_key = r.source_key AND latest.max_started = r.started_at
      ORDER BY r.started_at DESC`
  );
}

export async function getSyncRunErrors(runId) {
  return q(`SELECT * FROM mixed_map_sync_errors WHERE sync_run_id = ? ORDER BY created_at ASC`, [runId]);
}

export async function updateMapAdmin(mapKey, patch) {
  const allowed = [
    "name", "description", "thumbnail_url", "gamemode", "version",
    "public_visible", "voting_enabled", "token_enabled",
    "blacklisted_from_voting", "blacklisted_from_tokens",
    "custom_description", "custom_thumbnail_url",
  ];
  const jsonFields = ["authors", "tags", "objectives", "custom_tags"];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (patch[key] !== undefined) { sets.push(`\`${key}\` = ?`); params.push(patch[key]); }
  }
  for (const key of jsonFields) {
    if (patch[key] !== undefined) { sets.push(`\`${key}\` = ?`); params.push(toJson(patch[key])); }
  }
  if (!sets.length) return getMap(mapKey);
  params.push(mapKey);
  await q(`UPDATE mixed_maps SET ${sets.join(", ")} WHERE map_key = ?`, params);
  return getMap(mapKey);
}

