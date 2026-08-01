// cron/rankDiscordRoleSyncCron.js
/**
 * cron/rankDiscordRoleSyncCron.js
 *
 * Periodically reconciles Discord roles against LuckPerms rank membership,
 * for every rank that has a discordRoleId configured. Catches rank changes
 * made directly via LuckPerms (in-game/console) that bypass the dashboard API.
 *
 * Logic:
 *  1. Load all ranks with a discordRoleId set.
 *  2. For each such rank, find the linked website users (discordId) who
 *     currently hold that LuckPerms group.
 *  3. Fetch the full guild member list once.
 *  4. For each guild member, diff their current tracked roles against the
 *     roles their linked ranks say they should have, and add/remove as needed.
 *
 * Runs every 15 minutes.
 */

import cron from "node-cron";
import { client } from "../controllers/discordController.js";
import db, { luckpermsDb } from "../controllers/databaseController.js";
import { diffTrackedRoles } from "../lib/discord/rankRoleSync.mjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function queryLuckPermsDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    luckpermsDb.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function reconcileRankDiscordRoles() {
  if (!features.ranks) return;

  const guildId = config.discord?.guildId;
  if (!guildId) return;

  try {
    const ranks = await queryDb(
      `SELECT rankSlug, discordRoleId FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''`
    );
    if (ranks.length === 0) return;

    const trackedRoleIds = ranks.map((r) => String(r.discordRoleId));

    // Map: linked website userId -> Set of discordRoleIds they should have.
    const shouldHaveByUserId = new Map();
    let anyRankHadMembers = false;

    for (const rank of ranks) {
      try {
        const lpRows = await queryLuckPermsDb(
          `SELECT LOWER(HEX(uuid)) AS uuid FROM luckperms_user_permissions
            WHERE permission = ? AND value = 1`,
          [`group.${rank.rankSlug}`]
        );
        if (lpRows.length === 0) continue;
        anyRankHadMembers = true;

        const uuids = lpRows.map((r) => r.uuid);
        const placeholders = uuids.map(() => "?").join(", ");
        const webUsers = await queryDb(
          `SELECT userId, discordId FROM users WHERE LOWER(REPLACE(uuid, '-', '')) IN (${placeholders}) AND discordId IS NOT NULL`,
          uuids
        );

        for (const user of webUsers) {
          if (!shouldHaveByUserId.has(user.userId)) {
            shouldHaveByUserId.set(user.userId, { discordId: user.discordId, roleIds: new Set() });
          }
          shouldHaveByUserId.get(user.userId).roleIds.add(String(rank.discordRoleId));
        }
      } catch (err) {
        console.error(`[rankRoleSync-cron] Error resolving members for rank ${rank.rankSlug}:`, err.message);
      }
    }

    // Circuit breaker: if every rank had LuckPerms members but NONE resolved to a
    // linked website account, something is wrong with the uuid mapping (not "nobody
    // is linked") — refuse to run the removal sweep rather than risk stripping every
    // guild member's roles.
    if (anyRankHadMembers && shouldHaveByUserId.size === 0) {
      console.warn("[rankRoleSync-cron] LuckPerms ranks have members but none resolved to a linked account — skipping sweep (possible uuid mapping bug).");
      return;
    }

    const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      console.warn("[rankRoleSync-cron] Guild not found. Skipping.");
      return;
    }
    await guild.members.fetch();

    // Build discordId -> should-have role set for a fast lookup while sweeping all members.
    const shouldHaveByDiscordId = new Map();
    for (const { discordId, roleIds } of shouldHaveByUserId.values()) {
      shouldHaveByDiscordId.set(discordId, [...roleIds]);
    }

    let updated = 0;
    for (const [, member] of guild.members.cache) {
      const shouldHaveRoleIds = shouldHaveByDiscordId.get(member.id) || [];
      const currentRoleIds = [...member.roles.cache.keys()];
      const { toAdd, toRemove } = diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds);

      if (toAdd.length === 0 && toRemove.length === 0) continue;

      try {
        if (toAdd.length) await member.roles.add(toAdd);
        if (toRemove.length) await member.roles.remove(toRemove);
        updated++;
      } catch (err) {
        console.error(`[rankRoleSync-cron] Failed to update roles for ${member.id}:`, err.message);
      }
    }

    console.log(`[rankRoleSync-cron] Reconciliation complete. ${updated} member(s) updated.`);
  } catch (err) {
    console.error("[rankRoleSync-cron] Fatal error during reconciliation:", err);
  }
}

// Run every 15 minutes
cron.schedule("*/15 * * * *", () => {
  reconcileRankDiscordRoles();
});

// Also run once on startup (after a short delay to let the DB pool and
// Discord client settle).
setTimeout(() => {
  reconcileRankDiscordRoles();
}, 15_000);

export { reconcileRankDiscordRoles };
