/**
 * routes/dashboard/voting.js
 *
 * Admin dashboard routes for the Voting & Reward system.
 *
 *   GET  /dashboard/voting             — Vote sites management
 *   GET  /dashboard/voting/rewards     — Reward template management
 *   GET  /dashboard/voting/queue       — Reward command queue
 *   GET  /dashboard/voting/leaderboard — Monthly leaderboard admin view
 */

import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

export default function dashboardVotingSiteRoute(app, fetch, config, db, features, lang) {

  // =========================================================================
  // GET /dashboard/voting — Vote sites list & management
  // =========================================================================
  app.get("/dashboard/voting", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;
    if (!await hasPermission("zander.web.voting", req, res, features)) return;

    try {
      const [sitesRes, leaderboardRes] = await Promise.all([
        fetch(`${process.env.siteAddress}/admin/vote/sites`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/vote/leaderboard`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
      ]);

      const sitesData = await sitesRes.json();
      const leaderboardData = await leaderboardRes.json();

      return res.view("dashboard/voting/sites", {
        pageTitle: "Dashboard - Voting Sites",
        config,
        req,
        features,
        sitesData,
        leaderboardData,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading voting dashboard",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // =========================================================================
  // GET /dashboard/voting/rewards — Reward template management
  // =========================================================================
  app.get("/dashboard/voting/rewards", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;
    if (!await hasPermission("zander.web.voting", req, res, features)) return;

    try {
      const templatesRes = await fetch(`${process.env.siteAddress}/admin/vote/reward-templates`, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const templatesData = await templatesRes.json();

      return res.view("dashboard/voting/rewards", {
        pageTitle: "Dashboard - Reward Templates",
        config,
        req,
        features,
        templatesData,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting/rewards:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading reward templates",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // =========================================================================
  // GET /dashboard/voting/queue — Reward command queue viewer
  // =========================================================================
  app.get("/dashboard/voting/queue", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;
    if (!await hasPermission("zander.web.voting", req, res, features)) return;

    const status = req.query.status || "";
    const playerUuid = req.query.playerUuid || "";
    const validStatuses = ["", "pending", "claimed", "completed", "failed"];

    if (!validStatuses.includes(status)) {
      return res.redirect("/dashboard/voting/queue");
    }

    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (playerUuid) params.set("playerUuid", playerUuid);
      params.set("limit", "200");

      const queueRes = await fetch(
        `${process.env.siteAddress}/admin/vote/queue?${params.toString()}`,
        { headers: { "x-access-token": process.env.apiKey } }
      );
      const queueData = await queueRes.json();

      return res.view("dashboard/voting/queue", {
        pageTitle: "Dashboard - Reward Queue",
        config,
        req,
        features,
        queueData,
        activeStatus: status,
        activePlayerUuid: playerUuid,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting/queue:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading queue",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // =========================================================================
  // GET /dashboard/voting/leaderboard — Monthly leaderboard admin view
  // =========================================================================
  app.get("/dashboard/voting/leaderboard", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;
    if (!await hasPermission("zander.web.voting", req, res, features)) return;

    const now = new Date();
    const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = req.query.month || defaultMonth;

    try {
      const [boardRes, resultsRes] = await Promise.all([
        fetch(`${process.env.siteAddress}/vote/leaderboard?month=${encodeURIComponent(month)}&limit=50`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/admin/vote/monthly/results?month=${encodeURIComponent(month)}`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
      ]);

      const boardData = await boardRes.json();
      const resultsData = await resultsRes.json();

      return res.view("dashboard/voting/leaderboard", {
        pageTitle: "Dashboard - Vote Leaderboard",
        config,
        req,
        features,
        boardData,
        resultsData,
        activeMonth: month,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting/leaderboard:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading leaderboard",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });
}
