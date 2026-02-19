// AUDIT ONLY — this module never adds or removes Discord roles.
// All role mutation logic must live in a separate module.
// When a future sync engine is built, it must only run when
// a dedicated `sync_enabled` config flag is true, and must
// never import or call anything from this file to mutate roles.

import db from "../../controllers/databaseController.js";

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
}

/**
 * Fetch all ranks that have a Discord role ID configured.
 * @returns {Promise<Map<string, string>>} Map of rankSlug → discordRoleId
 */
export async function getTrackedRanks() {
  const rows = await runQuery(
    `SELECT rankSlug, discordRoleId
     FROM ranks
     WHERE discordRoleId IS NOT NULL AND discordRoleId != ''`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.rankSlug, row.discordRoleId);
  }
  return map;
}

/**
 * Fetch all LP users who hold at least one tracked LP group (active, non-expired).
 * Queries the LP permissions table directly so expiry is respected.
 * @returns {Promise<Array<{uuid, username, discordId, lpGroups}>>}
 */
export async function getTrackedLPUsers() {
  const rows = await runQuery(
    `SELECT
       lup.uuid,
       COALESCE(u.username, lpp.username) AS username,
       u.discordId,
       GROUP_CONCAT(
         DISTINCT SUBSTRING_INDEX(lup.permission, '.', -1)
         ORDER BY lup.permission
         SEPARATOR ','
       ) AS lpGroupsRaw
     FROM cfcdev_luckperms.luckperms_user_permissions lup
     JOIN ranks r
       ON SUBSTRING_INDEX(lup.permission, '.', -1) = r.rankSlug
       AND r.discordRoleId IS NOT NULL
       AND r.discordRoleId != ''
     LEFT JOIN users u ON u.uuid = lup.uuid
     LEFT JOIN luckPermsPlayers lpp ON lpp.uuid = lup.uuid
     WHERE lup.permission LIKE 'group.%'
       AND lup.value = 1
       AND (lup.expiry IS NULL OR lup.expiry = 0 OR lup.expiry > UNIX_TIMESTAMP())
     GROUP BY lup.uuid, u.username, lpp.username, u.discordId`
  );

  return rows.map((row) => ({
    uuid: row.uuid,
    username: row.username || row.uuid,
    discordId: row.discordId && row.discordId.trim() ? row.discordId.trim() : null,
    lpGroups: row.lpGroupsRaw ? row.lpGroupsRaw.split(",") : [],
  }));
}

/**
 * Given a user's LP groups and the tracked ranks map, return the Discord role IDs
 * they are expected to hold.
 * @param {string[]} lpGroups
 * @param {Map<string, string>} ranksMap
 * @returns {string[]}
 */
export function computeExpectedRoles(lpGroups, ranksMap) {
  const roleIds = [];
  for (const group of lpGroups) {
    const roleId = ranksMap.get(group);
    if (roleId) roleIds.push(roleId);
  }
  return roleIds;
}

/**
 * Run the full LP ↔ Discord audit. This function is read-only and never
 * assigns or removes any Discord roles.
 *
 * @param {import("discord.js").Guild} guild
 * @returns {Promise<{
 *   unlinked: Array<{uuid, username, lpGroups, expectedRoleIds}>,
 *   notInGuild: Array<{uuid, username, discordId, lpGroups, expectedRoleIds}>,
 *   missingRoles: Array<{uuid, username, discordId, lpGroups, missingRoles, missingRoleIds}>,
 *   summary: {total, trackedRankCount}
 * }>}
 */
export async function runAudit(guild) {
  const ranksMap = await getTrackedRanks();
  const trackedRankCount = ranksMap.size;

  if (trackedRankCount === 0) {
    return {
      unlinked: [],
      notInGuild: [],
      missingRoles: [],
      summary: { total: 0, trackedRankCount: 0 },
    };
  }

  const lpUsers = await getTrackedLPUsers();

  // Bulk-fetch all guild members once to avoid per-user Discord API calls.
  let guildMembers;
  try {
    guildMembers = await guild.members.fetch();
  } catch (err) {
    console.error("[lpaudit] Failed to bulk-fetch guild members:", err);
    guildMembers = new Map();
  }

  // Reverse map: discordRoleId → rankSlug (for readable output)
  const slugByRoleId = new Map(
    [...ranksMap.entries()].map(([slug, id]) => [id, slug])
  );

  const unlinked = [];
  const notInGuild = [];
  const missingRoles = [];

  for (const user of lpUsers) {
    // Section A: no Discord ID recorded in our system.
    // expectedRoleIds records what a sync would need to remove.
    if (!user.discordId) {
      unlinked.push({
        uuid: user.uuid,
        username: user.username,
        lpGroups: user.lpGroups,
        expectedRoleIds: computeExpectedRoles(user.lpGroups, ranksMap),
      });
      continue;
    }

    const member = guildMembers.get(user.discordId);

    // Section B: Discord ID exists but user is not in the guild.
    // expectedRoleIds records what a sync would need to remove.
    if (!member) {
      notInGuild.push({
        uuid: user.uuid,
        username: user.username,
        discordId: user.discordId,
        lpGroups: user.lpGroups,
        expectedRoleIds: computeExpectedRoles(user.lpGroups, ranksMap),
      });
      continue;
    }

    // Section C: in guild but missing one or more expected Discord roles
    const expectedRoleIds = computeExpectedRoles(user.lpGroups, ranksMap);
    const missingRoleIds = expectedRoleIds.filter(
      (id) => !member.roles.cache.has(id)
    );

    if (missingRoleIds.length > 0) {
      missingRoles.push({
        uuid: user.uuid,
        username: user.username,
        discordId: user.discordId,
        lpGroups: user.lpGroups,
        missingRoles: missingRoleIds.map((id) => slugByRoleId.get(id) || id),
        missingRoleIds,
      });
    }
  }

  return {
    unlinked,
    notInGuild,
    missingRoles,
    summary: { total: lpUsers.length, trackedRankCount },
  };
}
