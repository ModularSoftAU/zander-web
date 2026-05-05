/**
 * routes/dashboard/badges.js
 *
 * Admin dashboard routes for the Badge system.
 *
 *   GET  /dashboard/badges                    — badge list & management
 *   GET  /dashboard/badges/create             — create badge form
 *   GET  /dashboard/badges/:id/edit           — edit badge form
 *   GET  /dashboard/badges/:id/assign         — assign badge to a user form
 *
 * Session-authenticated proxy routes (forward to /admin/badges API):
 *   POST   /dashboard/badges
 *   PUT    /dashboard/badges/:id
 *   DELETE /dashboard/badges/:id
 *   POST   /dashboard/badges/:id/duplicate
 *   POST   /dashboard/badges/:id/assign/:userId
 *   DELETE /dashboard/badges/:id/assign/:userId
 */

import {
  getGlobalImage,
  hasPermission,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { UserGetter } from "../../controllers/userController.js";

async function proxyToApi(fetch, method, path, body) {
  const res = await fetch(`${process.env.siteAddress}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-access-token": process.env.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function dashboardBadgesRoute(app, fetch, config, db, features, lang) {

  // =========================================================================
  // GET /dashboard/badges — badge list & management
  // =========================================================================
  app.get("/dashboard/badges", async function (req, res) {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;

    let badgesData = { success: false, data: [] };
    try {
      const r = await fetch(`${process.env.siteAddress}/admin/badges`, {
        headers: { "x-access-token": process.env.apiKey },
      });
      badgesData = await r.json();
    } catch (error) {
      console.error("[dashboard/badges] Failed to fetch badges:", error);
    }

    const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/badges/index", {
        pageTitle: "Dashboard - Badges",
        config,
        req,
        features,
        badgesData,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });

  // =========================================================================
  // GET /dashboard/badges/create — create badge form
  // =========================================================================
  app.get("/dashboard/badges/create", async function (req, res) {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;

    const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/badges/edit", {
        pageTitle: "Dashboard - Create Badge",
        config,
        req,
        features,
        badge: null,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });

  // =========================================================================
  // GET /dashboard/badges/:id/edit — edit badge form
  // =========================================================================
  app.get("/dashboard/badges/:id/edit", async function (req, res) {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;

    const id = parseInt(req.params.id, 10);
    if (!id) return res.redirect("/dashboard/badges");

    let badge = null;
    try {
      const r = await fetch(`${process.env.siteAddress}/admin/badges`, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const all = await r.json();
      badge = (all.data || []).find((b) => b.badgeId === id) || null;
    } catch (error) {
      console.error("[dashboard/badges] Failed to fetch badge for edit:", error);
    }

    if (!badge) return res.redirect("/dashboard/badges");

    const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/badges/edit", {
        pageTitle: "Dashboard - Edit Badge",
        config,
        req,
        features,
        badge,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });

  // =========================================================================
  // GET /dashboard/badges/:id/assign — assign badge to user form
  // =========================================================================
  app.get("/dashboard/badges/:id/assign", async function (req, res) {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;

    const id = parseInt(req.params.id, 10);
    if (!id) return res.redirect("/dashboard/badges");

    let badge = null;
    try {
      const r = await fetch(`${process.env.siteAddress}/admin/badges`, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const all = await r.json();
      badge = (all.data || []).find((b) => b.badgeId === id) || null;
    } catch (error) {
      console.error("[dashboard/badges] Failed to fetch badge for assign:", error);
    }

    if (!badge) return res.redirect("/dashboard/badges");

    const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/badges/assign", {
        pageTitle: "Dashboard - Assign Badge",
        config,
        req,
        features,
        badge,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });

  // =========================================================================
  // Session-authenticated proxy routes
  // =========================================================================

  app.post("/dashboard/badges", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;
    res.send(await proxyToApi(fetch, "POST", "/admin/badges", req.body));
    return;
  });

  app.put("/dashboard/badges/:id", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;
    res.send(await proxyToApi(fetch, "PUT", `/admin/badges/${req.params.id}`, req.body));
    return;
  });

  app.delete("/dashboard/badges/:id", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;
    res.send(await proxyToApi(fetch, "DELETE", `/admin/badges/${req.params.id}`));
    return;
  });

  app.post("/dashboard/badges/:id/duplicate", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;
    res.send(await proxyToApi(fetch, "POST", `/admin/badges/${req.params.id}/duplicate`));
    return;
  });

  app.post("/dashboard/badges/:id/assign/:userId", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;
    res.send(await proxyToApi(fetch, "POST", `/admin/badges/${req.params.id}/assign/${req.params.userId}`));
    return;
  });

  app.delete("/dashboard/badges/:id/assign/:userId", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;
    res.send(await proxyToApi(fetch, "DELETE", `/admin/badges/${req.params.id}/assign/${req.params.userId}`));
    return;
  });

  // Search users for the assign form (session-authenticated proxy)
  app.get("/dashboard/badges/user-search", async (req, res) => {
    if (!await hasPermission("zander.web.badges", req, res, features)) return;

    const q = (req.query.q || "").trim();
    if (!q || q.length < 2) return res.send({ success: false, data: [] });

    try {
      const getter = new UserGetter();
      const user = await getter.byUsername(q);
      if (!user) return res.send({ success: true, data: [] });
      return res.send({
        success: true,
        data: [{ userId: user.userId, username: user.username }],
      });
    } catch (error) {
      console.error("[dashboard/badges] user-search error:", error);
      if (!res.sent) return res.status(500).send({ success: false, data: [] });
    }
  });
}
