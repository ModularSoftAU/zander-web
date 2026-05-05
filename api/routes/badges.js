/**
 * api/routes/badges.js
 *
 * All routes require x-access-token (applied globally in app.js).
 *
 * GET    /admin/badges                        — list all badges
 * POST   /admin/badges                        — create badge
 * GET    /admin/badges/:id                    — get single badge
 * PUT    /admin/badges/:id                    — update badge
 * DELETE /admin/badges/:id                    — delete badge
 * POST   /admin/badges/:id/duplicate          — duplicate badge
 * GET    /admin/badges/user/:userId           — get user's badges
 * POST   /admin/badges/user/:userId/assign    — assign badge to user
 * DELETE /admin/badges/user/:userId/:badgeId  — remove badge from user
 */

import {
  getAllBadges,
  getBadgeById,
  createBadge,
  updateBadge,
  deleteBadge,
  duplicateBadge,
  getUserBadges,
  assignBadgeToUser,
  removeBadgeFromUser,
} from "../../controllers/badgeController.js";
import { prisma } from "../../controllers/databaseController.js";

function validateHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export default function badgesApiRoute(app, config, db, features, lang) {

  // ── List all badges ────────────────────────────────────────────────────────
  app.get("/admin/badges", async (req, res) => {
    try {
      const data = await getAllBadges();
      return res.send({ success: true, data });
    } catch (error) {
      console.error("[badges] GET /admin/badges:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Get single badge ───────────────────────────────────────────────────────
  app.get("/admin/badges/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid badge id." });
    try {
      const badge = await getBadgeById(id);
      if (!badge) return res.send({ success: false, message: "Badge not found." });
      return res.send({ success: true, data: badge });
    } catch (error) {
      console.error("[badges] GET /admin/badges/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Create badge ───────────────────────────────────────────────────────────
  app.post("/admin/badges", async (req, res) => {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const iconUrl = String(body.iconUrl || "").trim();
    const backgroundColor = String(body.backgroundColor || "#1a1a2e").trim();
    const textColor = String(body.textColor || "#ffd700").trim();
    const luckpermsGroup = String(body.luckpermsGroup || "").trim();

    if (!name) return res.send({ success: false, message: "Name is required." });
    if (name.length > 100) return res.send({ success: false, message: "Name must be 100 characters or fewer." });
    if (!validateHexColor(backgroundColor)) return res.send({ success: false, message: "backgroundColor must be a valid hex colour (e.g. #1a1a2e)." });
    if (!validateHexColor(textColor)) return res.send({ success: false, message: "textColor must be a valid hex colour (e.g. #ffd700)." });

    try {
      const badge = await createBadge({ name, description: description || null, iconUrl: iconUrl || null, backgroundColor, textColor, luckpermsGroup: luckpermsGroup || null });
      return res.send({ success: true, message: "Badge created.", data: badge });
    } catch (error) {
      console.error("[badges] POST /admin/badges:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Update badge ───────────────────────────────────────────────────────────
  app.put("/admin/badges/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid badge id." });

    const body = req.body || {};
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const iconUrl = String(body.iconUrl || "").trim();
    const backgroundColor = String(body.backgroundColor || "#1a1a2e").trim();
    const textColor = String(body.textColor || "#ffd700").trim();
    const luckpermsGroup = String(body.luckpermsGroup || "").trim();

    if (!name) return res.send({ success: false, message: "Name is required." });
    if (name.length > 100) return res.send({ success: false, message: "Name must be 100 characters or fewer." });
    if (!validateHexColor(backgroundColor)) return res.send({ success: false, message: "backgroundColor must be a valid hex colour (e.g. #1a1a2e)." });
    if (!validateHexColor(textColor)) return res.send({ success: false, message: "textColor must be a valid hex colour (e.g. #ffd700)." });

    try {
      const badge = await updateBadge(id, { name, description: description || null, iconUrl: iconUrl || null, backgroundColor, textColor, luckpermsGroup: luckpermsGroup || null });
      return res.send({ success: true, message: "Badge updated.", data: badge });
    } catch (error) {
      console.error("[badges] PUT /admin/badges/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Delete badge ───────────────────────────────────────────────────────────
  app.delete("/admin/badges/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid badge id." });
    try {
      await deleteBadge(id);
      return res.send({ success: true, message: "Badge deleted." });
    } catch (error) {
      console.error("[badges] DELETE /admin/badges/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Duplicate badge ────────────────────────────────────────────────────────
  app.post("/admin/badges/:id/duplicate", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid badge id." });
    try {
      const badge = await duplicateBadge(id);
      return res.send({ success: true, message: "Badge duplicated.", data: badge });
    } catch (error) {
      console.error("[badges] POST /admin/badges/:id/duplicate:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Get user's badges ──────────────────────────────────────────────────────
  app.get("/admin/badges/user/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.send({ success: false, message: "Invalid userId." });
    try {
      const badges = await getUserBadges(userId);
      return res.send({ success: true, data: badges });
    } catch (error) {
      console.error("[badges] GET /admin/badges/user/:userId:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Assign badge to user ───────────────────────────────────────────────────
  app.post("/admin/badges/user/:userId/assign", async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.send({ success: false, message: "Invalid userId." });

    const badgeId = parseInt((req.body || {}).badgeId, 10);
    if (!badgeId) return res.send({ success: false, message: "badgeId is required." });

    try {
      // Verify the user exists
      const user = await prisma.users.findUnique({ where: { userId }, select: { userId: true, username: true } });
      if (!user) return res.send({ success: false, message: "User not found." });

      // Verify the badge exists
      const badge = await getBadgeById(badgeId);
      if (!badge) return res.send({ success: false, message: "Badge not found." });

      await assignBadgeToUser(userId, badgeId, 1);
      return res.send({ success: true, message: `Badge "${badge.name}" assigned to ${user.username}.` });
    } catch (error) {
      console.error("[badges] POST /admin/badges/user/:userId/assign:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ── Remove badge from user ─────────────────────────────────────────────────
  app.delete("/admin/badges/user/:userId/:badgeId", async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const badgeId = parseInt(req.params.badgeId, 10);
    if (!userId || !badgeId) return res.send({ success: false, message: "Invalid userId or badgeId." });

    try {
      await removeBadgeFromUser(userId, badgeId);
      return res.send({ success: true, message: "Badge removed from user." });
    } catch (error) {
      if (error?.code === "P2025") return res.send({ success: false, message: "That badge is not assigned to this user." });
      console.error("[badges] DELETE /admin/badges/user/:userId/:badgeId:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });
}
