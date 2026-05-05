/**
 * cron/badgeLuckpermsSync.js
 *
 * Runs every 30 minutes. For each badge linked to a LuckPerms group:
 *   1. Finds all website users who have that LP group.
 *   2. Auto-assigns the badge (isManual = 0) to those users if not already held.
 *   3. Removes auto-assigned (isManual = 0) badge from users who no longer have the group.
 *
 * Manual badge assignments (isManual = 1) are never touched by this sync.
 */

import cron from "node-cron";
import { luckpermsDb, prisma } from "../controllers/databaseController.js";
import {
  getAllLpLinkedBadges,
  assignBadgeToUser,
  getAutoAssignedUserBadges,
  removeAutoAssignedBadge,
} from "../controllers/badgeController.js";

async function getLpGroupMembers(groupSlug) {
  return new Promise((resolve, reject) => {
    luckpermsDb.query(
      `SELECT uuid FROM luckperms_user_permissions
        WHERE permission = ? AND value = 1`,
      [`group.${groupSlug}`],
      (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map((r) => r.uuid.toLowerCase()));
      }
    );
  });
}

async function getUserIdsByUuids(uuids) {
  if (!uuids.length) return {};
  const byUuid = {};
  // Query in batches to avoid huge IN clauses
  const BATCH = 200;
  for (let i = 0; i < uuids.length; i += BATCH) {
    const slice = uuids.slice(i, i + BATCH);
    const users = await prisma.users.findMany({
      where: { uuid: { in: slice } },
      select: { userId: true, uuid: true },
    });
    for (const u of users) byUuid[u.uuid.toLowerCase()] = u.userId;
  }
  return byUuid;
}

export async function runBadgeLuckpermsSync() {
  const badges = await getAllLpLinkedBadges();
  if (!badges.length) return;

  console.log(`[badgeLuckpermsSync] Syncing ${badges.length} LP-linked badge(s)…`);

  for (const badge of badges) {
    try {
      const memberUuids = await getLpGroupMembers(badge.luckpermsGroup);
      const uuidToUserId = await getUserIdsByUuids(memberUuids);
      const currentMemberUserIds = new Set(Object.values(uuidToUserId));

      // 1. Assign to all current group members (upsert, keeps manual intact)
      for (const userId of currentMemberUserIds) {
        await assignBadgeToUser(userId, badge.badgeId, 0);
      }

      // 2. Remove from users who no longer have the group (auto-assigned only)
      const existing = await getAutoAssignedUserBadges(badge.badgeId);
      for (const ub of existing) {
        if (!currentMemberUserIds.has(ub.userId)) {
          await removeAutoAssignedBadge(ub.userId, badge.badgeId);
        }
      }
    } catch (err) {
      console.error(`[badgeLuckpermsSync] Error syncing badge ${badge.badgeId} (${badge.luckpermsGroup}):`, err);
    }
  }

  console.log(`[badgeLuckpermsSync] Sync complete.`);
}

// Run every 30 minutes
const task = cron.schedule("*/30 * * * *", async () => {
  try {
    await runBadgeLuckpermsSync();
  } catch (err) {
    console.error("[badgeLuckpermsSync] Unexpected error:", err);
  }
}, { timezone: "UTC" });

task.start();
