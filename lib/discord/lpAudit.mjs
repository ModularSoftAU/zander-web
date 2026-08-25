// AUDIT ONLY — this module never adds or removes Discord roles.
// All role mutation logic must live in a separate module.
// When a future sync engine is built, it must only run when
// a dedicated `sync_enabled` config flag is true, and must
// never import or call anything from this file to mutate roles.

import db, { luckpermsDb } from "../../controllers/databaseController.js";

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
}

function runLuckPermsQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    luckpermsDb.query(sql, params, (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
}

/**
 * Fetch all ranks that have a Discord role ID configured.
 * Queries LuckPerms directly — the `ranks` cross-database view only ever
 * worked when LuckPerms shared a MySQL server with the main DB, which is
 * not true in production (LUCKPERMS_URL is a separate instance).
 * @returns {Promise<Map<string, string>>} Map of rankSlug → discordRoleId
 */
export async function getTrackedRanks() {
  const rows = await runLuckPermsQuery(
    `SELECT
       lpGroups.name AS rankSlug,
       SUBSTRING_INDEX(lpMetaDiscordId.permission, '.', -1) AS discordRoleId
     FROM luckperms_groups lpGroups
       JOIN luckperms_group_permissions lpMetaDiscordId
         ON lpGroups.name = lpMetaDiscordId.name
         AND lpMetaDiscordId.permission LIKE 'meta.discordid.%'
         AND lpMetaDiscordId.value = 1`
  );

  const map = new Map();
  for (const row of rows) {
    const discordRoleId = row.discordRoleId ? row.discordRoleId.trim() : "";
    if (discordRoleId) {
      map.set(row.rankSlug, discordRoleId);
    }
  }
  return map;
}

/**
 * Fetch all LP users who hold at least one tracked LP group (active, non-expired).
 * Queries the LP permissions table directly so expiry is respected, then
 * enriches usernames/discordIds from the main DB in a second pass (LuckPerms
 * is a separate MySQL instance, so no cross-server join is possible).
 * @param {Map<string, string>} ranksMap - rankSlug → discordRoleId, from getTrackedRanks()
 * @returns {Promise<Array<{uuid, username, discordId, lpGroups}>>}
 */
export async function getTrackedLPUsers(ranksMap) {
  if (!ranksMap || ranksMap.size === 0) return [];

  const rows = await runLuckPermsQuery(
    `SELECT LOWER(HEX(uuid)) AS uuid, permission
     FROM luckperms_user_permissions
     WHERE permission LIKE 'group.%'
       AND value = 1
       AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`
  );

  const groupsByUuid = new Map();
  for (const row of rows) {
    const rankSlug = row.permission.slice("group.".length);
    if (!ranksMap.has(rankSlug)) continue;

    if (!groupsByUuid.has(row.uuid)) {
      groupsByUuid.set(row.uuid, new Set());
    }
    groupsByUuid.get(row.uuid).add(rankSlug);
  }

  const uuids = [...groupsByUuid.keys()];
  if (!uuids.length) return [];

  const [lpPlayers, webUsers] = await Promise.all([
    runLuckPermsQuery(
      `SELECT LOWER(HEX(uuid)) AS uuid, username FROM luckperms_players WHERE uuid IN (${uuids
        .map(() => "UNHEX(?)")
        .join(", ")})`,
      uuids
    ),
    runQuery(
      `SELECT username, discordId, uuid FROM users WHERE LOWER(REPLACE(uuid, '-', '')) IN (${uuids
        .map(() => "?")
        .join(", ")})`,
      uuids
    ),
  ]);

  const lpUsernameByUuid = new Map(lpPlayers.map((p) => [p.uuid, p.username]));
  const webUserByUuid = new Map(
    webUsers.map((u) => [u.uuid.replace(/-/g, "").toLowerCase(), u])
  );

  return uuids.map((uuid) => {
    const webUser = webUserByUuid.get(uuid);
    const discordId = webUser?.discordId ? webUser.discordId.trim() : "";
    return {
      uuid,
      username: webUser?.username || lpUsernameByUuid.get(uuid) || uuid,
      discordId: discordId || null,
      lpGroups: [...groupsByUuid.get(uuid)],
    };
  });
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
 * Fetch the set of Discord IDs that are already linked in our system.
 * Used to detect guild members who hold tracked roles but have no link.
 * @returns {Promise<Set<string>>}
 */
async function getLinkedDiscordIds() {
  const rows = await runQuery(
    `SELECT discordId FROM users WHERE discordId IS NOT NULL AND discordId != ''`
  );
  return new Set(rows.map((r) => r.discordId.trim()));
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
 *   discordNotLinked: Array<{discordId, discordTag, heldRoles, heldRoleIds}>,
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
      discordNotLinked: [],
      summary: { total: 0, trackedRankCount: 0 },
    };
  }

  // Run DB and Discord fetches in parallel.
  const [lpUsers, linkedDiscordIds, guildMembersFetched] = await Promise.all([
    getTrackedLPUsers(),
    getLinkedDiscordIds(),
    guild.members.fetch().catch((err) => {
      console.error("[lpaudit] Failed to bulk-fetch guild members:", err);
      return new Map();
    }),
  ]);

  const guildMembers = guildMembersFetched;

  // Reverse map: discordRoleId → rankSlug (for readable output)
  const slugByRoleId = new Map(
    [...ranksMap.entries()].map(([slug, id]) => [id, slug])
  );
  const allTrackedRoleIds = new Set(ranksMap.values());

  const unlinked = [];
  const notInGuild = [];
  const missingRoles = [];
  const discordNotLinked = [];

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

  // Section D: guild members who hold tracked Discord roles but are not linked
  // in our system at all. Approached from the Discord side so we catch people
  // like a player who was manually given a role and never linked their account.
  for (const [memberId, member] of guildMembers) {
    if (linkedDiscordIds.has(memberId)) continue;

    const heldRoleIds = [...allTrackedRoleIds].filter((id) =>
      member.roles.cache.has(id)
    );
    if (heldRoleIds.length === 0) continue;

    discordNotLinked.push({
      discordId: memberId,
      discordTag: member.user.tag,
      heldRoles: heldRoleIds.map((id) => slugByRoleId.get(id) || id),
      heldRoleIds,
    });
  }

  return {
    unlinked,
    notInGuild,
    missingRoles,
    discordNotLinked,
    summary: { total: lpUsers.length, trackedRankCount },
  };
}
