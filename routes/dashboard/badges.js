/**
 * routes/dashboard/badges.js
 *
 * Admin dashboard routes for badge management.
 *
 *   GET    /dashboard/badges                       — badge list UI
 *
 * Session-authenticated proxy routes (browser never sees the API key):
 *   POST   /dashboard/badges
 *   PUT    /dashboard/badges/:id
 *   DELETE /dashboard/badges/:id
 *   POST   /dashboard/badges/:id/duplicate
 *   GET    /dashboard/badges/user/:userId
 *   POST   /dashboard/badges/user/:userId/assign
 *   DELETE /dashboard/badges/user/:userId/:badgeId
 */

import { getGlobalImage, hasPermission } from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

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

  const perm = "zander.web.badges";

  // ── Page: badge list ───────────────────────────────────────────────────────
  app.get("/dashboard/badges", async function (req, res) {
    if (!await hasPermission(perm, req, res, features)) return;

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
      await app.view("dashboard/badges/list", {
        pageTitle: "Dashboard - Badges",
        config,
        req,
        features,
        badgesData,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ── Session-authenticated proxy routes ─────────────────────────────────────

  app.post("/dashboard/badges", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "POST", "/admin/badges", req.body));
  });

  app.put("/dashboard/badges/:id", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "PUT", `/admin/badges/${req.params.id}`, req.body));
  });

  app.delete("/dashboard/badges/:id", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "DELETE", `/admin/badges/${req.params.id}`));
  });

  app.post("/dashboard/badges/:id/duplicate", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "POST", `/admin/badges/${req.params.id}/duplicate`));
  });

  app.get("/dashboard/badges/user/:userId", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "GET", `/admin/badges/user/${req.params.userId}`));
  });

  app.post("/dashboard/badges/user/:userId/assign", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "POST", `/admin/badges/user/${req.params.userId}/assign`, req.body));
  });

  app.delete("/dashboard/badges/user/:userId/:badgeId", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    res.send(await proxyToApi(fetch, "DELETE", `/admin/badges/user/${req.params.userId}/${req.params.badgeId}`));
  });

  // Resolve a username to a userId, then assign — so the browser never touches the API key
  app.post("/dashboard/badges/assign-by-username", async (req, res) => {
    if (!await hasPermission(perm, req, res, features)) return;
    const { username, badgeId } = req.body || {};
    if (!username) return res.send({ success: false, message: "Username is required." });
    if (!badgeId) return res.send({ success: false, message: "badgeId is required." });

    try {
      const userResp = await fetch(
        `${process.env.siteAddress}/api/user/get?username=${encodeURIComponent(username)}`,
        { headers: { "x-access-token": process.env.apiKey } }
      );
      const userData = await userResp.json();
      if (!userData.success || !userData.data || !userData.data.length) {
        return res.send({ success: false, message: "User not found." });
      }
      const userId = userData.data[0].userId;
      res.send(await proxyToApi(fetch, "POST", `/admin/badges/user/${userId}/assign`, { badgeId }));
    } catch (err) {
      console.error("[dashboard/badges] assign-by-username error:", err);
      if (!res.sent) res.send({ success: false, message: `${err}` });
    }
  });
}
