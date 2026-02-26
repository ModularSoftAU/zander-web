import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

export default function dashboardRanksRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  app.get("/dashboard/ranks", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.ranks, req, res, features))) return;

    const hasRankPermission = await hasPermission(
      "zander.web.rank",
      req,
      res,
      features
    );

    if (!hasRankPermission) return;

    const response = await fetch(`${process.env.siteAddress}/api/rank/get`, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const rankData = await response.json();

    { await res.view("dashboard/ranks/index", {
      pageTitle: `Dashboard - Ranks`,
      config: config,
      features: features,
      req: req,
      ranks: Array.isArray(rankData.data)
        ? rankData.data.filter((r) => !r.name?.startsWith("griefdefender_"))
        : [],
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    }); return; }
  });
}
