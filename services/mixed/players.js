/**
 * services/mixed/players.js
 *
 * Player career totals, player list, global leaderboards and achievements.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q, one, isValidUuid, normaliseUuid } from "./_shared.js";

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
