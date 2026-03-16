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

/** Parse an internal API response, surfacing HTTP errors as thrown exceptions. */
async function apiJson(response, label) {
  const text = await response.text();
  if (!text) throw new Error(`Empty response from ${label} (HTTP ${response.status})`);
  return JSON.parse(text);
}

export default function dashboardVotingSiteRoute(app, fetch, config, db, features, lang) {

  // =========================================================================
  // GET /dashboard/voting — Vote sites list & management
  // =========================================================================
  app.get("/dashboard/voting", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;

    try {
      if (!await hasPermission("zander.web.voting", req, res, features)) return;

      const [sitesRes, leaderboardRes] = await Promise.all([
        fetch(`${process.env.siteAddress}/admin/vote/sites`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/vote/leaderboard`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
      ]);

      const sitesData = await apiJson(sitesRes, "/admin/vote/sites");
      const leaderboardData = await apiJson(leaderboardRes, "/vote/leaderboard");

      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/voting/sites", {
          pageTitle: "Dashboard - Voting Sites",
          config,
          req,
          features,
          sitesData,
          leaderboardData,
          globalImage,
          announcementWeb,
        })
      );
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting:", error);
      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error loading voting dashboard",
          config,
          req,
          error,
          features,
          globalImage,
          announcementWeb,
        })
      );
    }
  });

  // =========================================================================
  // GET /dashboard/voting/rewards — Reward template management
  // =========================================================================
  app.get("/dashboard/voting/rewards", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;

    try {
      if (!await hasPermission("zander.web.voting", req, res, features)) return;

      const templatesRes = await fetch(`${process.env.siteAddress}/admin/vote/reward-templates`, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const templatesData = await apiJson(templatesRes, "/admin/vote/reward-templates");

      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/voting/rewards", {
          pageTitle: "Dashboard - Reward Templates",
          config,
          req,
          features,
          templatesData,
          globalImage,
          announcementWeb,
        })
      );
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting/rewards:", error);
      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error loading reward templates",
          config,
          req,
          error,
          features,
          globalImage,
          announcementWeb,
        })
      );
    }
  });

  // =========================================================================
  // GET /dashboard/voting/queue — Reward command queue viewer
  // =========================================================================
  app.get("/dashboard/voting/queue", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;

    const status = req.query.status || "";
    const playerUuid = req.query.playerUuid || "";
    const validStatuses = ["", "pending", "claimed", "completed", "failed"];

    if (!validStatuses.includes(status)) {
      return res.redirect("/dashboard/voting/queue");
    }

    try {
      if (!await hasPermission("zander.web.voting", req, res, features)) return;

      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (playerUuid) params.set("playerUuid", playerUuid);
      params.set("limit", "200");

      const queueRes = await fetch(
        `${process.env.siteAddress}/admin/vote/queue?${params.toString()}`,
        { headers: { "x-access-token": process.env.apiKey } }
      );
      const queueData = await apiJson(queueRes, "/admin/vote/queue");

      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/voting/queue", {
          pageTitle: "Dashboard - Reward Queue",
          config,
          req,
          features,
          queueData,
          activeStatus: status,
          activePlayerUuid: playerUuid,
          globalImage,
          announcementWeb,
        })
      );
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting/queue:", error);
      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error loading queue",
          config,
          req,
          error,
          features,
          globalImage,
          announcementWeb,
        })
      );
    }
  });

  // =========================================================================
  // GET /dashboard/voting/leaderboard — Monthly leaderboard admin view
  // =========================================================================
  app.get("/dashboard/voting/leaderboard", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.voting, req, res, features)) return;

    const now = new Date();
    const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = req.query.month || defaultMonth;

    try {
      if (!await hasPermission("zander.web.voting", req, res, features)) return;

      const [boardRes, resultsRes] = await Promise.all([
        fetch(`${process.env.siteAddress}/vote/leaderboard?month=${encodeURIComponent(month)}&limit=50`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/admin/vote/monthly/results?month=${encodeURIComponent(month)}`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
      ]);

      const boardData = await apiJson(boardRes, "/vote/leaderboard");
      const resultsData = await apiJson(resultsRes, "/admin/vote/monthly/results");

      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/voting/leaderboard", {
          pageTitle: "Dashboard - Vote Leaderboard",
          config,
          req,
          features,
          boardData,
          resultsData,
          activeMonth: month,
          globalImage,
          announcementWeb,
        })
      );
    } catch (error) {
      console.error("[dashboard/voting] GET /dashboard/voting/leaderboard:", error);
      const [globalImage, announcementWeb] = await Promise.all([getGlobalImage(), getWebAnnouncement()]);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error loading leaderboard",
          config,
          req,
          error,
          features,
          globalImage,
          announcementWeb,
        })
      );
    }
  });
}
