/**
 * controllers/badgeController.js
 *
 * CRUD operations for the badge system using Prisma.
 * Badges can be manually assigned to users by admins, or automatically synced
 * from a linked LuckPerms group (isManual = 0). Manual badges are never
 * removed by the LP sync.
 */

import { prisma } from "./databaseController.js";

// ─── Badge definitions ───────────────────────────────────────────────────────

export function getAllBadges() {
  return prisma.badges.findMany({ orderBy: { createdAt: "asc" } });
}

export function getBadgeById(badgeId) {
  return prisma.badges.findUnique({ where: { badgeId } });
}

export function createBadge({ name, description, iconUrl, backgroundColor, luckpermsGroup }) {
  return prisma.badges.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      iconUrl: iconUrl?.trim() || null,
      backgroundColor: backgroundColor?.trim() || "#1a1a2e",
      luckpermsGroup: luckpermsGroup?.trim() || null,
    },
  });
}

export function updateBadge(badgeId, { name, description, iconUrl, backgroundColor, luckpermsGroup }) {
  return prisma.badges.update({
    where: { badgeId },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      iconUrl: iconUrl?.trim() || null,
      backgroundColor: backgroundColor?.trim() || "#1a1a2e",
      luckpermsGroup: luckpermsGroup?.trim() || null,
    },
  });
}

export function deleteBadge(badgeId) {
  return prisma.badges.delete({ where: { badgeId } });
}

export async function duplicateBadge(badgeId) {
  const source = await getBadgeById(badgeId);
  if (!source) throw new Error("Badge not found");
  const { badgeId: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
  return prisma.badges.create({ data: { ...rest, name: `${rest.name} (Copy)` } });
}

export function getAllLpLinkedBadges() {
  return prisma.badges.findMany({ where: { luckpermsGroup: { not: null } } });
}

// ─── User badge ownership ────────────────────────────────────────────────────

export function getUserBadges(userId) {
  return prisma.userBadges.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: "asc" },
  });
}

export async function assignBadgeToUser(userId, badgeId, isManual = 1) {
  return prisma.userBadges.upsert({
    where: { userId_badgeId: { userId, badgeId } },
    create: { userId, badgeId, isManual },
    // Promote to manual if requested; never downgrade an existing manual badge
    update: isManual === 1 ? { isManual: 1 } : {},
  });
}

export function removeBadgeFromUser(userId, badgeId) {
  return prisma.userBadges.delete({ where: { userId_badgeId: { userId, badgeId } } });
}

export function getAutoAssignedUserBadges(badgeId) {
  return prisma.userBadges.findMany({ where: { badgeId, isManual: 0 } });
}

export function removeAutoAssignedBadge(userId, badgeId) {
  return prisma.userBadges.deleteMany({ where: { userId, badgeId, isManual: 0 } });
}
