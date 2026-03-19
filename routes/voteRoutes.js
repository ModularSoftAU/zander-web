/**
 * routes/voteRoutes.js
 *
 * Public-facing voting page routes.
 *
 *   GET /vote        — Voting sites list & current leaderboard
 */

import {
  getGlobalImage,
  isFeatureWebRouteEnabled,
} from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";

export default function voteSiteRoutes(app, fetch, config, db, features, lang) {

  // =========================================================================
  // GET /vote — Public voting landing page
  // =========================================================================
  app.get("/vote", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.vote, req, res, features)) return;

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    try {
      const [sitesRes, leaderboardRes] = await Promise.all([
        fetch(`${process.env.siteAddress}/vote/sites`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/vote/leaderboard?month=${encodeURIComponent(monthKey)}&limit=10`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
      ]);

      const sitesData = await sitesRes.json();
      const leaderboardData = await leaderboardRes.json();

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("modules/vote/index", {
        pageTitle: `Vote`,
        pageDescription: `Vote for ${config.siteConfiguration.siteName} on your favourite server listing sites and earn rewards!`,
        config,
        req,
        features,
        sitesData,
        leaderboardData,
        currentMonth: monthKey,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      }));
      return;
    } catch (error) {
      console.error("[vote] GET /vote:", error);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading voting page",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      }));
      return;
    }
  });
}
