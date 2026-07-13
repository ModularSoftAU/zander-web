/**
 * mixedController.js
 *
 * Data-access layer for the Mixed module — the public PGM stats portal that
 * receives data from the zander-pgm plugin.
 *
 * All queries run against the primary application database via the mysql2
 * pool (promise interface). Tables are created by migration 0026_mixed_module.
 *
 * This module deliberately contains no moderation / punishment logic — Mixed
 * is stats, maps, players, voting, ratings, tokens and entitlements only.
 */

import pool from "./databaseController.js";

// Promise-based query helper over the shared mysql2 pool.
const conn = pool.promise();
export async function q(sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}
async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

export function isValidUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function normaliseUuid(value) {
  if (!isValidUuid(value)) return null;
  const hex = value.trim().replace(/-/g, "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Basic HTML-stripping + trim used before storing/showing player feedback. */
export function sanitiseFeedback(text) {
  if (text == null) return null;
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function toJson(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}
function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function firstNonEmptyString(values = []) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalisePeopleList(...lists) {
  return [...new Set(
    lists
      .flat()
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
  )];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings() {
  const row = await one(`SELECT * FROM mixed_settings WHERE id = 1`);
  return row || {};
}

export async function updateSettings(patch) {
  const allowed = [
    "vote_duration_seconds", "vote_options_count", "map_cooldown_minutes",
    "token_nominate_cost", "token_set_next_cost", "token_sponsor_cost",
    "token_boost_weight", "player_cooldown_minutes", "allow_web_voting",
    "public_feedback_enabled",
  ];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      params.push(patch[key]);
    }
  }
  if (!sets.length) return getSettings();
  await q(`UPDATE mixed_settings SET ${sets.join(", ")} WHERE id = 1`, params);
  return getSettings();
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

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

/** Applies the custom-override-over-repo-data fallback chain used by public map views. */
function withDisplayFields(row) {
  const inferredTags = parseJson(row.inferred_tags, []);
  const customTags = parseJson(row.custom_tags, []);
  const authors = normalisePeopleList(parseJson(row.authors, []));
  const contributors = normalisePeopleList(parseJson(row.contributors, []));
  const screenshots = parseJson(row.screenshots_from_repo, []);
  const fallbackImage = firstNonEmptyString(screenshots);
  const displayThumbnailUrl = row.custom_thumbnail_url || row.thumbnail_from_repo || row.thumbnail_url || fallbackImage || null;
  // Placeholder rows (discovered from live play, not yet matched to a repo
  // sync) store the raw map_key as name until a sync fills in the real one —
  // prettify that case instead of showing the slug verbatim.
  const displayName = row.name && row.name !== row.map_key
    ? row.name
    : String(row.map_key || row.name || "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || row.name;
  return {
    ...row,
    authors,
    contributors,
    screenshots_from_repo: screenshots,
    display_name: displayName,
    display_authors: authors.length ? authors : contributors,
    display_description: row.custom_description || row.description_from_xml || row.description || "No description available.",
    display_thumbnail_url: displayThumbnailUrl,
    display_image_url: displayThumbnailUrl,
    display_tags: [...new Set([...(inferredTags || []), ...(customTags || [])])],
  };
}

/** Strips repo-source fields from a map row for non-admin public responses. */
function stripSourceInfo(row) {
  const {
    source_key, source_display_name, source_org, source_repo,
    source_branch, source_path, source_commit, ...rest
  } = row;
  return rest;
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

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export async function upsertMatch(data) {
  const players = Array.isArray(data.players) ? data.players : null;
  const participantsCount = data.participants_count ?? (players ? players.length : null);
  const totalKills = data.total_kills ?? (players
    ? players.reduce((sum, p) => sum + (Number(p.kills) || 0), 0)
    : null);
  const totalDeaths = data.total_deaths ?? (players
    ? players.reduce((sum, p) => sum + (Number(p.deaths) || 0), 0)
    : null);

  await q(
    `INSERT INTO mixed_matches
       (match_id, server_id, map_key, map_name, gamemode, status, started_at,
        ended_at, duration_seconds, winners, participants_count, total_kills,
        total_deaths, total_objectives, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IFNULL(?, 0), IFNULL(?, 0), IFNULL(?, 0), IFNULL(?, 0), ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       ended_at = COALESCE(VALUES(ended_at), ended_at),
       duration_seconds = COALESCE(VALUES(duration_seconds), duration_seconds),
       winners = COALESCE(VALUES(winners), winners),
       participants_count = COALESCE(?, participants_count),
       total_kills = COALESCE(?, total_kills),
       total_deaths = COALESCE(?, total_deaths),
       total_objectives = COALESCE(?, total_objectives),
       metadata = COALESCE(VALUES(metadata), metadata)`,
    [
      data.match_id, data.server_id || null, data.map_key || null,
      data.map_name || null, data.gamemode || null, data.status || "loaded",
      data.started_at || null, data.ended_at || null, data.duration_seconds ?? null,
      toJson(data.winners), participantsCount, totalKills,
      totalDeaths, data.total_objectives ?? null, toJson(data.metadata),
      participantsCount, totalKills, totalDeaths, data.total_objectives ?? null,
    ]
  );
  return getMatch(data.match_id);
}

// Called once per completed match to bump the map browser's "times played"
// counter and aggregate totals — nothing else in the ingestion pipeline
// touches mixed_maps.times_played / mixed_map_totals.
export async function recordMapPlay(mapKey, { durationSeconds = 0, totalKills = 0, totalObjectives = 0, winnerTeam = null } = {}) {
  if (!mapKey) return;
  const duration = Number(durationSeconds) || 0;

  await q(
    `UPDATE mixed_maps
        SET times_played = times_played + 1,
            last_played_at = NOW(),
            average_duration_seconds = CASE
              WHEN times_played = 0 THEN ?
              ELSE ROUND((average_duration_seconds * times_played + ?) / (times_played + 1))
            END
      WHERE map_key = ?`,
    [duration, duration, mapKey]
  );

  const initialWinCounts = winnerTeam ? toJson({ [winnerTeam]: 1 }) : toJson({});
  await q(
    `INSERT INTO mixed_map_totals
       (map_key, times_played, total_duration_seconds, total_kills, total_objectives,
        team_win_counts, fastest_match_seconds, longest_match_seconds, last_played_at)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       times_played = times_played + 1,
       total_duration_seconds = total_duration_seconds + VALUES(total_duration_seconds),
       total_kills = total_kills + VALUES(total_kills),
       total_objectives = total_objectives + VALUES(total_objectives),
       team_win_counts = IF(? IS NULL, team_win_counts, JSON_SET(
         COALESCE(team_win_counts, JSON_OBJECT()),
         CONCAT('$."', ?, '"'),
         COALESCE(JSON_EXTRACT(team_win_counts, CONCAT('$."', ?, '"')), 0) + 1
       )),
       fastest_match_seconds = LEAST(COALESCE(fastest_match_seconds, VALUES(fastest_match_seconds)), VALUES(fastest_match_seconds)),
       longest_match_seconds = GREATEST(COALESCE(longest_match_seconds, VALUES(longest_match_seconds)), VALUES(longest_match_seconds)),
       last_played_at = NOW()`,
    [
      mapKey, duration, totalKills, totalObjectives, initialWinCounts,
      duration || null, duration || null,
      winnerTeam || null, winnerTeam || null, winnerTeam || null,
    ]
  );
}

export async function getMatch(matchId) {
  const row = await one(
    `SELECT mt.*,
            COALESCE(mm.name, mt.map_name, mt.map_key) AS resolved_map_name,
            COALESCE(mm.gamemode, mt.gamemode) AS resolved_gamemode
       FROM mixed_matches mt
       LEFT JOIN mixed_maps mm ON mm.map_key = mt.map_key
      WHERE mt.match_id = ?`,
    [matchId]
  );
  if (!row) return null;
  row.winners = parseJson(row.winners, []);
  row.metadata = parseJson(row.metadata, {});
  const players = await q(
    `SELECT * FROM mixed_match_players WHERE match_id = ? ORDER BY kills DESC`, [matchId]
  );
  return {
    ...row,
    map_name: row.resolved_map_name || row.map_name || row.map_key,
    gamemode: row.resolved_gamemode || row.gamemode,
    players,
  };
}

export async function getMatchEvents(matchId) {
  const rows = await q(
    `SELECT * FROM mixed_match_events WHERE match_id = ? ORDER BY occurred_at ASC, id ASC`,
    [matchId]
  );
  return rows.map((r) => ({ ...r, payload: parseJson(r.payload, {}) }));
}

export async function listMatches({
  search, mapKey, gamemode, serverId, winner, playerUuid,
  minDuration, maxDuration, dateFrom, dateTo,
  page = 1, limit = 25,
} = {}) {
  const where = [];
  const params = [];
  if (mapKey) { where.push(`mt.map_key = ?`); params.push(mapKey); }
  if (gamemode) { where.push(`COALESCE(mm.gamemode, mt.gamemode) = ?`); params.push(gamemode); }
  if (serverId) { where.push(`mt.server_id = ?`); params.push(serverId); }
  if (winner) { where.push(`JSON_SEARCH(mt.winners, 'one', ?) IS NOT NULL`); params.push(winner); }
  if (minDuration) { where.push(`mt.duration_seconds >= ?`); params.push(minDuration); }
  if (maxDuration) { where.push(`mt.duration_seconds <= ?`); params.push(maxDuration); }
  if (dateFrom) { where.push(`mt.started_at >= ?`); params.push(dateFrom); }
  if (dateTo) { where.push(`mt.started_at <= ?`); params.push(dateTo); }
  if (search) {
    where.push(`(COALESCE(mm.name, mt.map_name, mt.map_key) LIKE ? OR mt.match_id LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }

  let joinPlayer = "";
  if (playerUuid) {
    if (isValidUuid(playerUuid)) {
      joinPlayer = `JOIN mixed_match_players mp ON mp.match_id = mt.match_id AND mp.player_uuid = ?`;
      params.unshift(normaliseUuid(playerUuid));
    } else {
      joinPlayer = `JOIN mixed_match_players mp ON mp.match_id = mt.match_id AND mp.username LIKE ?`;
      params.unshift(`%${playerUuid}%`);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (Math.max(1, page) - 1) * limit;

  const rows = await q(
    `SELECT DISTINCT mt.*,
            COALESCE(mm.name, mt.map_name, mt.map_key) AS resolved_map_name,
            COALESCE(mm.gamemode, mt.gamemode) AS resolved_gamemode
       FROM mixed_matches mt
       LEFT JOIN mixed_maps mm ON mm.map_key = mt.map_key
       ${joinPlayer} ${whereSql}
     ORDER BY mt.started_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRow = await one(
    `SELECT COUNT(DISTINCT mt.match_id) AS total
       FROM mixed_matches mt
       LEFT JOIN mixed_maps mm ON mm.map_key = mt.map_key
       ${joinPlayer} ${whereSql}`,
    params
  );
  return {
    matches: rows.map((r) => ({
      ...r,
      map_name: r.resolved_map_name || r.map_name || r.map_key,
      gamemode: r.resolved_gamemode || r.gamemode,
      winners: parseJson(r.winners, []),
    })),
    total: totalRow?.total || 0,
    page: Math.max(1, page),
    limit,
  };
}

export async function closeStaleMatches(maxAgeMinutes = 180) {
  const rows = await q(
    `UPDATE mixed_matches
        SET status = 'ended', ended_at = NOW()
      WHERE status IN ('loaded','running')
        AND started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [maxAgeMinutes]
  );
  return rows.affectedRows || 0;
}

// Removes matches that never got real stats written (participants_count = 0
// and total_kills = 0) — leftover stub rows from ensureMatchExists() with no
// followup /api/mixed/stats/match call. Only ever touches matches older than
// maxAgeMinutes so an in-progress match isn't deleted from under a live game.
export async function purgeEmptyMatches(maxAgeMinutes = 180) {
  const rows = await q(
    `SELECT match_id FROM mixed_matches
      WHERE participants_count = 0 AND total_kills = 0
        AND started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [maxAgeMinutes]
  );
  const matchIds = rows.map((r) => r.match_id);
  if (!matchIds.length) return { deleted: 0, matchIds: [] };

  const placeholders = matchIds.map(() => "?").join(",");
  await q(`DELETE FROM mixed_match_events WHERE match_id IN (${placeholders})`, matchIds);
  await q(`DELETE FROM mixed_match_players WHERE match_id IN (${placeholders})`, matchIds);
  await q(`DELETE FROM mixed_map_ratings WHERE match_id IN (${placeholders})`, matchIds);
  const result = await q(`DELETE FROM mixed_matches WHERE match_id IN (${placeholders})`, matchIds);
  return { deleted: result.affectedRows || 0, matchIds };
}

export async function getLiveMatches() {
  const rows = await q(
    `SELECT mt.*, s.display_name AS server_name, s.online AS server_online,
            s.player_count AS server_players, s.tps
       FROM mixed_matches mt
       JOIN mixed_servers s ON s.server_id = mt.server_id
      WHERE mt.status IN ('loaded','running') AND s.online = 1
      ORDER BY mt.started_at DESC`
  );
  return rows.map((r) => ({ ...r, winners: parseJson(r.winners, []) }));
}

export async function upsertMatchPlayer(matchId, p, mapKey = null) {
  await q(
    `INSERT INTO mixed_match_players
       (match_id, player_uuid, username, team_name, won, kills, deaths, assists,
        objectives, captures, wool_captures, flag_captures, core_leaks,
        destroyable_damage, control_point_captures, best_killstreak,
        longest_shot, furthest_bow_kill, damage_dealt, damage_taken, xp_earned, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username), team_name = VALUES(team_name), won = VALUES(won),
       kills = VALUES(kills), deaths = VALUES(deaths), assists = VALUES(assists),
       objectives = VALUES(objectives), captures = VALUES(captures),
       wool_captures = VALUES(wool_captures), flag_captures = VALUES(flag_captures),
       core_leaks = VALUES(core_leaks), destroyable_damage = VALUES(destroyable_damage),
       control_point_captures = VALUES(control_point_captures),
       best_killstreak = VALUES(best_killstreak), longest_shot = VALUES(longest_shot),
       furthest_bow_kill = VALUES(furthest_bow_kill), damage_dealt = VALUES(damage_dealt),
       damage_taken = VALUES(damage_taken), xp_earned = VALUES(xp_earned),
       metadata = VALUES(metadata)`,
    [
      matchId, p.player_uuid, p.username || null, p.team_name || null,
      p.won ? 1 : 0, p.kills || 0, p.deaths || 0, p.assists || 0,
      p.objectives || 0, p.captures || 0, p.wool_captures || 0, p.flag_captures || 0,
      p.core_leaks || 0, p.destroyable_damage || 0, p.control_point_captures || 0,
      p.best_killstreak || 0, p.longest_shot || 0, p.furthest_bow_kill || 0,
      p.damage_dealt || 0, p.damage_taken || 0, p.xp_earned || 0, toJson(p.metadata),
    ]
  );

  if (mapKey && isValidUuid(p.player_uuid)) {
    await upsertMapPlayerTotals(mapKey, p);
    if (p.kills) await updateMapRecord(mapKey, "most_kills_in_match", p.player_uuid, p.username, p.kills, matchId);
  }
}

// Career per-map-per-player aggregates, additive across matches. Backs
// "most kills on a map", "best K/D on a map" and "best killstreak on a map"
// leaderboards (see getMapLeaderboard below).
export async function upsertMapPlayerTotals(mapKey, p) {
  await q(
    `INSERT INTO mixed_map_player_totals
       (map_key, player_uuid, username, matches_played, wins, losses, kills, deaths,
        assists, objectives, captures, wool_captures, flag_captures, core_leaks,
        destroyable_damage, control_point_captures, best_killstreak, longest_shot,
        furthest_bow_kill, playtime_seconds)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       matches_played = matches_played + 1,
       wins = wins + VALUES(wins),
       losses = losses + VALUES(losses),
       kills = kills + VALUES(kills),
       deaths = deaths + VALUES(deaths),
       assists = assists + VALUES(assists),
       objectives = objectives + VALUES(objectives),
       captures = captures + VALUES(captures),
       wool_captures = wool_captures + VALUES(wool_captures),
       flag_captures = flag_captures + VALUES(flag_captures),
       core_leaks = core_leaks + VALUES(core_leaks),
       destroyable_damage = destroyable_damage + VALUES(destroyable_damage),
       control_point_captures = control_point_captures + VALUES(control_point_captures),
       best_killstreak = GREATEST(best_killstreak, VALUES(best_killstreak)),
       longest_shot = GREATEST(longest_shot, VALUES(longest_shot)),
       furthest_bow_kill = GREATEST(furthest_bow_kill, VALUES(furthest_bow_kill)),
       playtime_seconds = playtime_seconds + VALUES(playtime_seconds)`,
    [
      mapKey, p.player_uuid, p.username || null, p.won ? 1 : 0, p.won ? 0 : 1,
      p.kills || 0, p.deaths || 0, p.assists || 0, p.objectives || 0,
      p.captures || 0, p.wool_captures || 0, p.flag_captures || 0, p.core_leaks || 0,
      p.destroyable_damage || 0, p.control_point_captures || 0, p.best_killstreak || 0,
      p.longest_shot || 0, p.furthest_bow_kill || 0, p.playtime_seconds || 0,
    ]
  );
}

// Keeps the highest `value` seen for a (map, record_type) pair, attributing
// it to whichever player/match produced it. Used for single-event records
// like longest shot / furthest bow kill / most kills in one match.
export async function updateMapRecord(mapKey, recordType, playerUuid, username, value, matchId) {
  if (!mapKey || !recordType || !(value > 0)) return;
  await q(
    `INSERT INTO mixed_map_records (map_key, record_type, player_uuid, username, value, match_id, achieved_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       player_uuid = IF(VALUES(value) > value, VALUES(player_uuid), player_uuid),
       username = IF(VALUES(value) > value, VALUES(username), username),
       match_id = IF(VALUES(value) > value, VALUES(match_id), match_id),
       achieved_at = IF(VALUES(value) > value, VALUES(achieved_at), achieved_at),
       value = GREATEST(value, VALUES(value))`,
    [mapKey, recordType, playerUuid || null, username || null, value, matchId || null]
  );
}

export async function getMapRecords(mapKey) {
  return q(`SELECT * FROM mixed_map_records WHERE map_key = ?`, [mapKey]);
}

// "most kills", "best K/D", "best killstreak" etc. on a given map.
export async function getMapLeaderboard(mapKey, stat = "kills", limit = 10) {
  const columns = {
    kills: "kills",
    wool_captures: "wool_captures",
    flag_captures: "flag_captures",
    core_leaks: "core_leaks",
    destroyable_damage: "destroyable_damage",
    control_point_captures: "control_point_captures",
    best_killstreak: "best_killstreak",
  };
  if (stat === "kd") {
    return q(
      `SELECT *, kills / GREATEST(deaths, 1) AS kd
         FROM mixed_map_player_totals
        WHERE map_key = ? AND matches_played > 0
        ORDER BY kd DESC LIMIT ?`,
      [mapKey, limit]
    );
  }
  const col = columns[stat];
  if (!col) throw new Error(`Unknown leaderboard stat: ${stat}`);
  return q(
    `SELECT * FROM mixed_map_player_totals WHERE map_key = ? ORDER BY ${col} DESC LIMIT ?`,
    [mapKey, limit]
  );
}

export async function insertMatchEvent(e) {
  await q(
    `INSERT INTO mixed_match_events
       (match_id, server_id, map_key, event_type, player_uuid, target_uuid,
        assister_uuid, assister_username, team_name, cause, weapon, is_projectile,
        is_bow_kill, distance, team_kill, objective_type, objective_id,
        objective_name, action, capture_time_seconds, location, occurred_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.match_id, e.server_id || null, e.map_key || null, e.event_type, e.player_uuid || null,
      e.target_uuid || null, e.assister_uuid || null, e.assister_username || null,
      e.team_name || null, e.cause || null, e.weapon || null,
      e.is_projectile === undefined ? null : (e.is_projectile ? 1 : 0),
      e.is_bow_kill === undefined ? null : (e.is_bow_kill ? 1 : 0),
      e.distance ?? null,
      e.team_kill === undefined ? null : (e.team_kill ? 1 : 0),
      e.objective_type || null, e.objective_id || null, e.objective_name || null,
      e.action || null, e.capture_time_seconds ?? null, toJson(e.location),
      e.occurred_at || new Date(), toJson(e.payload),
    ]
  );

  // Kill/death records: longest shot and furthest bow kill on the map.
  if (e.map_key && e.distance > 0 && e.player_uuid) {
    await updateMapRecord(e.map_key, "longest_shot", e.player_uuid, e.username || null, e.distance, e.match_id);
    if (e.is_bow_kill) {
      await updateMapRecord(e.map_key, "furthest_bow_kill", e.player_uuid, e.username || null, e.distance, e.match_id);
    }
  }
}

// ---------------------------------------------------------------------------
// Player + map aggregate stats
// ---------------------------------------------------------------------------

export async function upsertPlayerTotals(data) {
  const cols = [
    "username", "level", "total_xp", "matches_played", "wins", "losses",
    "kills", "deaths", "assists", "objectives", "wool_captures", "flag_captures",
    "core_leaks", "destroyable_damage", "control_point_captures",
    "best_killstreak", "playtime_seconds",
  ];
  const values = cols.map((c) => (c === "username" ? (data[c] || null) : (data[c] || 0)));
  // Only update columns actually present in the payload — otherwise a partial
  // update (e.g. the XP endpoint sending just level/total_xp) would zero out
  // every other stat via the `data[c] || 0` default above.
  const providedCols = cols.filter((c) => data[c] !== undefined);
  const updates = providedCols.length
    ? providedCols.map((c) => `${c} = VALUES(${c})`).join(", ")
    : null;
  await q(
    `INSERT INTO mixed_player_totals (player_uuid, ${cols.join(", ")}, last_seen_at)
     VALUES (?, ${cols.map(() => "?").join(", ")}, NOW())
     ON DUPLICATE KEY UPDATE ${updates ? `${updates}, ` : ""}last_seen_at = NOW()`,
    [data.player_uuid, ...values]
  );
  return getPlayer(data.player_uuid);
}

export async function getPlayer(uuid) {
  const row = await one(`SELECT * FROM mixed_player_totals WHERE player_uuid = ?`, [uuid]);
  if (!row) return null;
  const [recentMatches, achievements, favouriteMaps, rank, balance] = await Promise.all([
    q(`SELECT mp.*, m.map_name, m.gamemode, m.started_at, m.status
         FROM mixed_match_players mp JOIN mixed_matches m ON m.match_id = mp.match_id
        WHERE mp.player_uuid = ? ORDER BY m.started_at DESC LIMIT 10`, [uuid]),
    q(`SELECT pa.*, a.name, a.description, a.rarity, a.xp_reward
         FROM mixed_player_achievements pa JOIN mixed_achievements a ON a.achievement_key = pa.achievement_key
        WHERE pa.player_uuid = ? ORDER BY pa.unlocked_at DESC`, [uuid]),
    q(`SELECT m.map_key, m.map_name, COUNT(*) AS plays,
              SUM(mp.won) AS wins, SUM(mp.kills) AS kills
         FROM mixed_match_players mp JOIN mixed_matches m ON m.match_id = mp.match_id
        WHERE mp.player_uuid = ? GROUP BY m.map_key, m.map_name
        ORDER BY plays DESC LIMIT 5`, [uuid]),
    one(`SELECT pr.rank_key, r.display_name, pr.expires_at
           FROM mixed_player_ranks pr LEFT JOIN mixed_ranks r ON r.rank_key = pr.rank_key
          WHERE pr.player_uuid = ? ORDER BY r.weight DESC LIMIT 1`, [uuid]),
    one(`SELECT * FROM mixed_map_token_balances WHERE player_uuid = ?`, [uuid]),
  ]);
  return { ...row, recentMatches, achievements, favouriteMaps, rank, tokenBalance: balance };
}

export async function listPlayers({ search, sort = "total_xp", order = "desc", page = 1, limit = 25 } = {}) {
  const where = [];
  const params = [];
  if (search) {
    if (isValidUuid(search)) { where.push(`player_uuid = ?`); params.push(normaliseUuid(search)); }
    else { where.push(`username LIKE ?`); params.push(`%${search}%`); }
  }
  const sortMap = {
    level: "level", total_xp: "total_xp", wins: "wins", kills: "kills",
    objectives: "objectives", last_seen: "last_seen_at",
  };
  const sortCol = sortMap[sort] || "total_xp";
  const dir = order === "asc" ? "ASC" : "DESC";
  const offset = (Math.max(1, page) - 1) * limit;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await q(
    `SELECT * FROM mixed_player_totals ${whereSql} ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRow = await one(`SELECT COUNT(*) AS total FROM mixed_player_totals ${whereSql}`, params);
  return { players: rows, total: totalRow?.total || 0, page: Math.max(1, page), limit };
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

const LEADERBOARD_COLUMNS = {
  level: "level", xp: "total_xp", wins: "wins", kills: "kills",
  kd: "(kills / GREATEST(deaths, 1))", objectives: "objectives",
  wool_captures: "wool_captures", flag_captures: "flag_captures",
  core_leaks: "core_leaks", destroyable_damage: "destroyable_damage",
  control_point_captures: "control_point_captures",
  best_killstreak: "best_killstreak", playtime: "playtime_seconds",
  win_rate: "(wins / GREATEST(matches_played, 1))",
};

export function leaderboardCategories() {
  return Object.keys(LEADERBOARD_COLUMNS);
}

export async function getLeaderboard(category, { limit = 50 } = {}) {
  const expr = LEADERBOARD_COLUMNS[category];
  if (!expr) return [];
  return q(
    `SELECT player_uuid, username, level, total_xp, wins, losses, kills, deaths,
            objectives, matches_played, ${expr} AS score
       FROM mixed_player_totals
      WHERE matches_played > 0
      ORDER BY score DESC LIMIT ?`,
    [limit]
  );
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export async function upsertAchievement(a) {
  await q(
    `INSERT INTO mixed_achievements (achievement_key, name, description, rarity, xp_reward, icon_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
       rarity = VALUES(rarity), xp_reward = VALUES(xp_reward), icon_url = VALUES(icon_url)`,
    [a.achievement_key, a.name || a.achievement_key, a.description || null,
     a.rarity || "common", a.xp_reward || 0, a.icon_url || null]
  );
}

export async function unlockAchievement(uuid, username, achievementKey) {
  const res = await q(
    `INSERT IGNORE INTO mixed_player_achievements (player_uuid, username, achievement_key)
     VALUES (?, ?, ?)`,
    [uuid, username || null, achievementKey]
  );
  if (res.affectedRows > 0) {
    await q(`UPDATE mixed_achievements SET unlock_count = unlock_count + 1 WHERE achievement_key = ?`,
      [achievementKey]);
  }
}

export async function listAchievements() {
  const rows = await q(`SELECT * FROM mixed_achievements ORDER BY rarity DESC, name ASC`);
  for (const a of rows) {
    a.recent = await q(
      `SELECT player_uuid, username, unlocked_at FROM mixed_player_achievements
        WHERE achievement_key = ? ORDER BY unlocked_at DESC LIMIT 5`, [a.achievement_key]
    );
  }
  return rows;
}

export async function latestAchievements(limit = 10) {
  return q(
    `SELECT pa.player_uuid, pa.username, pa.unlocked_at, a.name, a.rarity, a.xp_reward
       FROM mixed_player_achievements pa JOIN mixed_achievements a ON a.achievement_key = pa.achievement_key
      ORDER BY pa.unlocked_at DESC LIMIT ?`, [limit]
  );
}

// ---------------------------------------------------------------------------
// Map Tokens
// ---------------------------------------------------------------------------

export async function getTokenBalance(uuid) {
  const row = await one(`SELECT * FROM mixed_map_token_balances WHERE player_uuid = ?`, [uuid]);
  return row || { player_uuid: uuid, balance: 0, lifetime_earned: 0, lifetime_spent: 0 };
}

/**
 * Credit tokens to a player. Optionally tied to a Stripe session for idempotency
 * (the unique index on stripe_checkout_session_id prevents double credit).
 * Returns true if credited, false if the session was already processed.
 */
export async function creditTokens({ uuid, username, amount, type = "grant", reason, stripeSessionId, stripePaymentIntentId, metadata }) {
  const cx = await conn.getConnection();
  try {
    await cx.beginTransaction();
    try {
      await cx.query(
        `INSERT INTO mixed_map_token_transactions
           (player_uuid, type, amount, reason, stripe_checkout_session_id, stripe_payment_intent_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid, type, amount, reason || null, stripeSessionId || null,
         stripePaymentIntentId || null, toJson(metadata)]
      );
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        await cx.rollback();
        return false; // already processed this Stripe session
      }
      throw err;
    }
    await cx.query(
      `INSERT INTO mixed_map_token_balances (player_uuid, username, balance, lifetime_earned)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         balance = balance + VALUES(balance),
         lifetime_earned = lifetime_earned + VALUES(lifetime_earned),
         username = COALESCE(VALUES(username), username)`,
      [uuid, username || null, amount, amount]
    );
    await cx.commit();
    return true;
  } catch (err) {
    await cx.rollback();
    throw err;
  } finally {
    cx.release();
  }
}

export async function removeTokens({ uuid, amount, reason, type = "remove", metadata }) {
  const cx = await conn.getConnection();
  try {
    await cx.beginTransaction();
    const [balRows] = await cx.query(
      `SELECT balance FROM mixed_map_token_balances WHERE player_uuid = ? FOR UPDATE`, [uuid]
    );
    const balance = balRows[0]?.balance || 0;
    if (balance < amount) { await cx.rollback(); return { ok: false, balance }; }
    await cx.query(
      `INSERT INTO mixed_map_token_transactions (player_uuid, type, amount, reason, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid, type, -Math.abs(amount), reason || null, toJson(metadata)]
    );
    await cx.query(
      `UPDATE mixed_map_token_balances
          SET balance = balance - ?, lifetime_spent = lifetime_spent + ?
        WHERE player_uuid = ?`,
      [amount, amount, uuid]
    );
    await cx.commit();
    return { ok: true, balance: balance - amount };
  } catch (err) {
    await cx.rollback();
    throw err;
  } finally {
    cx.release();
  }
}

export async function refundTokens({ uuid, amount, reason }) {
  return creditTokens({ uuid, amount, type: "refund", reason });
}

export async function getTokenTransactions(uuid, limit = 100) {
  const rows = await q(
    `SELECT * FROM mixed_map_token_transactions WHERE player_uuid = ? ORDER BY created_at DESC LIMIT ?`,
    [uuid, limit]
  );
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

export async function listTokenBalances({ search, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (search) {
    if (isValidUuid(search)) { where.push(`player_uuid = ?`); params.push(normaliseUuid(search)); }
    else { where.push(`username LIKE ?`); params.push(`%${search}%`); }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return q(`SELECT * FROM mixed_map_token_balances ${whereSql} ORDER BY balance DESC LIMIT ?`,
    [...params, limit]);
}

// ---------------------------------------------------------------------------
// Map requests (token spends)
// ---------------------------------------------------------------------------

export async function createMapRequest({ uuid, username, mapKey, actionType, tokenCost }) {
  const res = await q(
    `INSERT INTO mixed_map_requests (player_uuid, username, map_key, action_type, token_cost, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [uuid, username || null, mapKey, actionType, tokenCost]
  );
  return getMapRequest(res.insertId);
}

export async function getMapRequest(id) {
  const row = await one(`SELECT * FROM mixed_map_requests WHERE id = ?`, [id]);
  if (row) row.metadata = parseJson(row.metadata);
  return row;
}

export async function listPendingMapRequests(limit = 50) {
  return q(
    `SELECT * FROM mixed_map_requests WHERE status IN ('pending','queued') ORDER BY requested_at ASC LIMIT ?`,
    [limit]
  );
}

export async function listPlayerMapRequests(uuid, limit = 50) {
  return q(`SELECT * FROM mixed_map_requests WHERE player_uuid = ? ORDER BY requested_at DESC LIMIT ?`,
    [uuid, limit]);
}

export async function setMapRequestStatus(id, status, { failureReason, appliedAt } = {}) {
  await q(
    `UPDATE mixed_map_requests
        SET status = ?,
            failure_reason = ?,
            applied_at = ${appliedAt ? "NOW()" : "applied_at"},
            refunded_at = ${status === "refunded" ? "NOW()" : "refunded_at"}
      WHERE id = ?`,
    [status, failureReason || null, id]
  );
  return getMapRequest(id);
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export async function startVote({ voteId, serverId, options = [], metadata }) {
  await q(
    `INSERT INTO mixed_map_votes (vote_id, server_id, status, started_at, metadata)
     VALUES (?, ?, 'active', NOW(), ?)
     ON DUPLICATE KEY UPDATE status = 'active', started_at = NOW(), metadata = VALUES(metadata)`,
    [voteId, serverId || null, toJson(metadata)]
  );
  for (const opt of options) {
    await q(
      `INSERT INTO mixed_map_vote_options
         (vote_id, map_key, map_name, source, token_request_id, base_weight, token_boost_weight)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE map_name = VALUES(map_name), token_boost_weight = VALUES(token_boost_weight)`,
      [voteId, opt.map_key, opt.map_name || null, opt.source || "rotation",
       opt.token_request_id || null, opt.base_weight || 1, opt.token_boost_weight || 0]
    );
  }
  return getVote(voteId);
}

export async function getVote(voteId) {
  const vote = await one(`SELECT * FROM mixed_map_votes WHERE vote_id = ?`, [voteId]);
  if (!vote) return null;
  vote.metadata = parseJson(vote.metadata, {});
  const options = await q(
    `SELECT o.*, m.thumbnail_url, m.gamemode
       FROM mixed_map_vote_options o
       LEFT JOIN mixed_maps m ON m.map_key = o.map_key
      WHERE o.vote_id = ? ORDER BY o.final_vote_count DESC`, [voteId]
  );
  const winning = options[0] || null;
  return { ...vote, options, winning };
}

export async function getCurrentVote() {
  const active = await one(`SELECT vote_id FROM mixed_map_votes WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
  return active ? getVote(active.vote_id) : null;
}

export async function endVote(voteId, { status = "ended", winningMapKey } = {}) {
  await q(
    `UPDATE mixed_map_votes SET status = ?, ended_at = NOW(), winning_map_key = ? WHERE vote_id = ?`,
    [status, winningMapKey || null, voteId]
  );
  return getVote(voteId);
}

export async function castVote({ voteId, uuid, username, mapKey, weight = 1, source = "web" }) {
  const cx = await conn.getConnection();
  try {
    await cx.beginTransaction();
    const [voteRows] = await cx.query(
      `SELECT status FROM mixed_map_votes WHERE vote_id = ? FOR UPDATE`, [voteId]
    );
    if (!voteRows[0] || voteRows[0].status !== "active") {
      await cx.rollback();
      return { ok: false, reason: "Vote is not active." };
    }
    try {
      await cx.query(
        `INSERT INTO mixed_map_vote_casts (vote_id, player_uuid, username, map_key, vote_weight, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [voteId, uuid, username || null, mapKey, weight, source]
      );
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        await cx.rollback();
        return { ok: false, reason: "You have already voted." };
      }
      throw err;
    }
    await cx.query(
      `UPDATE mixed_map_vote_options SET final_vote_count = final_vote_count + ?
        WHERE vote_id = ? AND map_key = ?`, [weight, voteId, mapKey]
    );
    await cx.commit();
    return { ok: true };
  } catch (err) {
    await cx.rollback();
    throw err;
  } finally {
    cx.release();
  }
}

export async function listVotes(limit = 25) {
  return q(`SELECT * FROM mixed_map_votes ORDER BY started_at DESC LIMIT ?`, [limit]);
}

export async function getMapVoteHistory(mapKey, limit = 10) {
  return q(
    `SELECT v.vote_id, v.status, v.started_at, v.winning_map_key, o.final_vote_count
       FROM mixed_map_vote_options o JOIN mixed_map_votes v ON v.vote_id = o.vote_id
      WHERE o.map_key = ? ORDER BY v.started_at DESC LIMIT ?`, [mapKey, limit]
  );
}

// ---------------------------------------------------------------------------
// Ratings + feedback
// ---------------------------------------------------------------------------

export async function submitRating({ mapKey, matchId, uuid, username, rating, feedback }) {
  const clean = sanitiseFeedback(feedback);
  await q(
    `INSERT INTO mixed_map_ratings (map_key, match_id, player_uuid, username, overall_rating, feedback)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE overall_rating = VALUES(overall_rating), feedback = VALUES(feedback),
       updated_at = NOW()`,
    [mapKey, matchId, uuid, username || null, rating, clean]
  );
  await recomputeRatingTotals(mapKey);
  return getMapRatingTotals(mapKey);
}

export async function recomputeRatingTotals(mapKey) {
  const stats = await one(
    `SELECT COUNT(*) AS cnt, AVG(overall_rating) AS avg,
            SUM(overall_rating = 1) AS s1, SUM(overall_rating = 2) AS s2,
            SUM(overall_rating = 3) AS s3, SUM(overall_rating = 4) AS s4,
            SUM(overall_rating = 5) AS s5,
            SUM(feedback IS NOT NULL AND feedback <> '') AS fb
       FROM mixed_map_ratings WHERE map_key = ?`, [mapKey]
  );
  await q(
    `INSERT INTO mixed_map_rating_totals
       (map_key, rating_count, average_overall, one_star_count, two_star_count,
        three_star_count, four_star_count, five_star_count, feedback_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating_count = VALUES(rating_count), average_overall = VALUES(average_overall),
       one_star_count = VALUES(one_star_count), two_star_count = VALUES(two_star_count),
       three_star_count = VALUES(three_star_count), four_star_count = VALUES(four_star_count),
       five_star_count = VALUES(five_star_count), feedback_count = VALUES(feedback_count)`,
    [mapKey, stats.cnt || 0, stats.avg || 0, stats.s1 || 0, stats.s2 || 0,
     stats.s3 || 0, stats.s4 || 0, stats.s5 || 0, stats.fb || 0]
  );
}

export async function getMapRatingTotals(mapKey) {
  const row = await one(`SELECT * FROM mixed_map_rating_totals WHERE map_key = ?`, [mapKey]);
  return row || {
    map_key: mapKey, rating_count: 0, average_overall: 0,
    one_star_count: 0, two_star_count: 0, three_star_count: 0,
    four_star_count: 0, five_star_count: 0, feedback_count: 0,
  };
}

export async function getMapFeedback(mapKey, { publicOnly = true, limit = 20 } = {}) {
  const where = [`map_key = ?`, `feedback IS NOT NULL`, `feedback <> ''`];
  const params = [mapKey];
  if (publicOnly) where.push(`feedback_visible = 1`);
  return q(
    `SELECT id, map_key, match_id, player_uuid, username, overall_rating, feedback,
            feedback_visible, feedback_hidden_reason, created_at
       FROM mixed_map_ratings WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC LIMIT ?`, [...params, limit]
  );
}

export async function listAllFeedback({ mapKey, rating, playerUuid, matchId, limit = 100 } = {}) {
  const where = [`feedback IS NOT NULL`, `feedback <> ''`];
  const params = [];
  if (mapKey) { where.push(`map_key = ?`); params.push(mapKey); }
  if (rating) { where.push(`overall_rating = ?`); params.push(rating); }
  if (playerUuid) { where.push(`player_uuid = ?`); params.push(playerUuid); }
  if (matchId) { where.push(`match_id = ?`); params.push(matchId); }
  return q(
    `SELECT * FROM mixed_map_ratings WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
}

export async function setFeedbackVisibility(ratingId, visible, reason) {
  await q(
    `UPDATE mixed_map_ratings SET feedback_visible = ?, feedback_hidden_reason = ? WHERE id = ?`,
    [visible ? 1 : 0, reason || null, ratingId]
  );
  const row = await one(`SELECT map_key FROM mixed_map_ratings WHERE id = ?`, [ratingId]);
  if (row) await recomputeRatingTotals(row.map_key);
  return row;
}

export async function deleteRating(ratingId) {
  const row = await one(`SELECT map_key FROM mixed_map_ratings WHERE id = ?`, [ratingId]);
  await q(`DELETE FROM mixed_map_ratings WHERE id = ?`, [ratingId]);
  if (row) await recomputeRatingTotals(row.map_key);
  return row;
}

export async function resetMapRatings(mapKey) {
  await q(`DELETE FROM mixed_map_ratings WHERE map_key = ?`, [mapKey]);
  await recomputeRatingTotals(mapKey);
}

export async function ratingsOverview() {
  const [highest, lowest, fewRatings] = await Promise.all([
    q(`SELECT rt.*, m.name FROM mixed_map_rating_totals rt JOIN mixed_maps m ON m.map_key = rt.map_key
        WHERE rt.rating_count >= 5 ORDER BY rt.average_overall DESC LIMIT 10`),
    q(`SELECT rt.*, m.name FROM mixed_map_rating_totals rt JOIN mixed_maps m ON m.map_key = rt.map_key
        WHERE rt.rating_count >= 5 ORDER BY rt.average_overall ASC LIMIT 10`),
    q(`SELECT rt.*, m.name FROM mixed_map_rating_totals rt JOIN mixed_maps m ON m.map_key = rt.map_key
        WHERE rt.rating_count < 5 ORDER BY rt.rating_count ASC LIMIT 10`),
  ]);
  return { highest, lowest, fewRatings };
}

/** True when a player participated in a match (required before rating). */
export async function didPlayerPlayMatch(uuid, matchId) {
  const row = await one(
    `SELECT 1 FROM mixed_match_players WHERE match_id = ? AND player_uuid = ? LIMIT 1`,
    [matchId, uuid]
  );
  return Boolean(row);
}

// ---------------------------------------------------------------------------
// Ranks + entitlements
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Admin overview + landing helpers
// ---------------------------------------------------------------------------

export async function adminOverview() {
  const [servers, recentMatches, pendingRequests, failedRequests, recentTx] = await Promise.all([
    listServers(),
    q(`SELECT * FROM mixed_matches ORDER BY started_at DESC LIMIT 10`),
    one(`SELECT COUNT(*) AS c FROM mixed_map_requests WHERE status IN ('pending','queued')`),
    one(`SELECT COUNT(*) AS c FROM mixed_map_requests WHERE status = 'failed'`),
    q(`SELECT * FROM mixed_map_token_transactions ORDER BY created_at DESC LIMIT 10`),
  ]);
  return {
    servers,
    recentMatches: recentMatches.map((r) => ({ ...r, winners: parseJson(r.winners, []) })),
    pendingRequests: pendingRequests?.c || 0,
    failedRequests: failedRequests?.c || 0,
    recentTransactions: recentTx,
  };
}

export async function landingData() {
  const [servers, live, featuredMaps, recentMatches, topLevel, latestAch, currentVote] = await Promise.all([
    listServers(),
    getLiveMatches(),
    q(`SELECT m.*, rt.average_overall, rt.rating_count FROM mixed_maps m
         LEFT JOIN mixed_map_rating_totals rt ON rt.map_key = m.map_key
        WHERE m.public_visible = 1 ORDER BY m.times_played DESC LIMIT 6`),
    q(`SELECT * FROM mixed_matches WHERE status = 'ended' ORDER BY started_at DESC LIMIT 6`),
    getLeaderboard("level", { limit: 5 }),
    latestAchievements(6),
    getCurrentVote(),
  ]);
  return {
    servers,
    liveMatch: live[0] || null,
    featuredMaps: featuredMaps.map((r) => withDisplayFields({
      ...r,
      authors: parseJson(r.authors, []),
      contributors: parseJson(r.contributors, []),
      inferred_tags: parseJson(r.inferred_tags, []),
      custom_tags: parseJson(r.custom_tags, []),
      screenshots_from_repo: parseJson(r.screenshots_from_repo, []),
    })),
    recentMatches: recentMatches.map((r) => ({
      ...r,
      winners: parseJson(r.winners, []),
    })),
    topLevel,
    latestAchievements: latestAch,
    currentVote,
  };
}
