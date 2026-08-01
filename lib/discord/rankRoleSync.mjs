/**
 * Diffs a member's current Discord roles against the roles they should have,
 * restricted to the set of role IDs that map to a rank (`trackedRoleIds`).
 * Role IDs outside that set are never touched, even if present in the inputs.
 */
export function diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds) {
  const current = new Set(currentRoleIds);
  const shouldHave = new Set(shouldHaveRoleIds);
  const tracked = new Set(trackedRoleIds);

  const toAdd = [...shouldHave].filter((id) => tracked.has(id) && !current.has(id));
  const toRemove = [...current].filter((id) => tracked.has(id) && !shouldHave.has(id));

  return { toAdd, toRemove };
}

async function queryDb(sql, params = []) {
  const { default: db } = await import("../../controllers/databaseController.js");
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

/** Every distinct Discord role ID configured on any rank. */
export async function getTrackedRoleIds() {
  const rows = await queryDb(
    `SELECT DISTINCT discordRoleId FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''`
  );
  return rows.map((r) => String(r.discordRoleId));
}

/** Discord role IDs for every rank the given LuckPerms player uuid currently holds. */
export async function getUserRoleIdsByUuid(uuid) {
  if (!uuid) return [];
  const rows = await queryDb(
    `SELECT r.discordRoleId
       FROM userRanks ur
       JOIN ranks r ON ur.rankSlug = r.rankSlug
      WHERE ur.uuid = ? AND r.discordRoleId IS NOT NULL AND r.discordRoleId != ''`,
    [uuid]
  );
  return rows.map((r) => String(r.discordRoleId));
}

import { client } from "../../controllers/discordController.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../../config.json");
const features = require("../../features.json");

async function fetchGuildMember(discordId) {
  const guildId = config.discord?.guildId;
  if (!guildId || !discordId) return null;

  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return null;

  return guild.members.fetch(discordId).catch(() => null);
}

/**
 * Grants/revokes the given user's rank-mapped Discord roles so their
 * Discord roles match their current LuckPerms ranks. Never throws.
 */
export async function syncMemberRankRoles(userId) {
  if (!features.ranks || !userId) return;

  try {
    const [webUser] = await queryDb(
      `SELECT uuid, discordId FROM users WHERE userId = ? LIMIT 1`,
      [userId]
    );
    if (!webUser?.discordId) return;

    const member = await fetchGuildMember(webUser.discordId);
    if (!member) return;

    const [trackedRoleIds, shouldHaveRoleIds] = await Promise.all([
      getTrackedRoleIds(),
      getUserRoleIdsByUuid(webUser.uuid),
    ]);

    const currentRoleIds = [...member.roles.cache.keys()];
    const { toAdd, toRemove } = diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds);

    if (toAdd.length) await member.roles.add(toAdd);
    if (toRemove.length) await member.roles.remove(toRemove);
  } catch (error) {
    console.error(`[rankRoleSync] Failed to sync roles for userId ${userId}:`, error.message);
  }
}

/**
 * Removes every tracked rank role from the given Discord user. Used when a
 * Discord account is unlinked, since we can no longer resolve their ranks.
 */
export async function stripAllTrackedRankRoles(discordId) {
  if (!features.ranks || !discordId) return;

  try {
    const member = await fetchGuildMember(discordId);
    if (!member) return;

    const trackedRoleIds = await getTrackedRoleIds();
    const currentRoleIds = [...member.roles.cache.keys()];
    const toRemove = currentRoleIds.filter((id) => trackedRoleIds.includes(id));

    if (toRemove.length) await member.roles.remove(toRemove);
  } catch (error) {
    console.error(`[rankRoleSync] Failed to strip roles for discordId ${discordId}:`, error.message);
  }
}
