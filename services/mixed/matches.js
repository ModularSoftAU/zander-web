/**
 * services/mixed/matches.js
 *
 * Matches, match players, match events, per-map play totals, map records and per-map leaderboards.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q, one, toJson, parseJson, isValidUuid, normaliseUuid } from "./_shared.js";

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

// A server can only ever be running one match at a time, so "live" means
// each online server's actual current_match_id — not every unclosed
// loaded/running row for that server (old stale matches pile up there until
// the stale-match cron closes them out, which would otherwise make one
// server look like it's running several matches at once).
export async function getLiveMatches() {
  const rows = await q(
    `SELECT mt.*, s.display_name AS server_name, s.online AS server_online,
            s.player_count AS server_players, s.tps,
            COALESCE(mm.name, mt.map_name, mt.map_key) AS resolved_map_name,
            mm.thumbnail_from_repo, mm.custom_thumbnail_url, mm.thumbnail_url
       FROM mixed_servers s
       JOIN mixed_matches mt ON mt.match_id = s.current_match_id
       LEFT JOIN mixed_maps mm ON mm.map_key = mt.map_key
      WHERE mt.status IN ('loaded','running') AND s.online = 1
      ORDER BY mt.started_at DESC`
  );
  return rows.map((r) => ({
    ...r,
    winners: parseJson(r.winners, []),
    display_map_name: r.resolved_map_name,
    display_image_url: r.custom_thumbnail_url || r.thumbnail_from_repo || r.thumbnail_url || null,
  }));
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

