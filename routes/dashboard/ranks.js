import {
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import prismaDb from "../../controllers/databaseController.js";

const RANK_VIEW = "ranks";

/**
 * Query the `ranks` cross-database view directly — same logic as
 * getRankDirectory() in api/routes/ranks.js but without the HTTP round-trip.
 */
function getAllRanks() {
  return new Promise((resolve, reject) => {
    prismaDb.query(
      `SELECT
        rankSlug,
        displayName,
        priority,
        rankBadgeColour,
        rankTextColour,
        discordRoleId,
        isStaff,
        isDonator
      FROM ${RANK_VIEW}
      ORDER BY CAST(COALESCE(priority, 0) AS UNSIGNED) DESC, rankSlug`,
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
}

export default function dashboardRanksRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  app.get("/dashboard/ranks", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.ranks, req, res, features)) return;

    const hasRankPermission = await hasPermission(
      "zander.web.rank",
      req,
      res,
      features
    );

    if (!hasRankPermission) return;

    const [rankRows, announcementWeb] = await Promise.all([
      getAllRanks().catch(() => []),
      getWebAnnouncement(),
    ]);

    // Filter out internal GriefDefender auto-groups
    const ranks = rankRows.filter(
      (r) => !r.rankSlug?.startsWith("griefdefender_")
    );

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/ranks/index", {
        pageTitle: `Dashboard - Ranks`,
        config,
        features,
        req,
        ranks,
        announcementWeb,
      })
    );
    return;
  });
}
