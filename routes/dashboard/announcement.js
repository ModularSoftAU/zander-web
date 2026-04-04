import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

export default function dashboardAnnouncementSiteRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  const headers = { "x-access-token": process.env.apiKey };

  /** Fetch a URL with the internal API key and parse JSON, returning fallback on error. */
  async function fetchJson(url, fallback = null) {
    try {
      const res = await fetch(url, { headers });
      return await res.json();
    } catch (error) {
      console.error(`[dashboard/announcements] fetchJson failed for ${url}:`, error.message);
      return fallback;
    }
  }

  //
  // Announcements
  //
  app.get("/dashboard/announcements", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.announcements, req, res, features))
      return;

    if (!await hasPermission("zander.web.announcements", req, res, features)) return;

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(`${process.env.siteAddress}/api/announcement/get`, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/announcements/announcements-list", {
        pageTitle: `Dashboard - Announcements`,
        config: config,
        apiData: apiData,
        features: features,
        req: req,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });

  app.get("/dashboard/announcements/create", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.announcements, req, res, features))
      return;

    if (!await hasPermission("zander.web.announcements", req, res, features)) return;

    const [globalImage, announcementWeb] = await Promise.all([
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/announcements/announcements-editor", {
        pageTitle: `Dashboard - Announcement Creator`,
        config: config,
        type: "create",
        features: features,
        req: req,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });

  app.get("/dashboard/announcements/edit", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.announcements, req, res, features))
      return;

    if (!await hasPermission("zander.web.announcements", req, res, features)) return;

    const announcementId = req.query.announcementId;
    const fetchURL = `${process.env.siteAddress}/api/announcement/get?announcementId=${announcementId}`;

    const [announcementApiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetchURL, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/announcements/announcements-editor", {
        pageTitle: `Dashboard - Announcement Editor`,
        config: config,
        announcementApiData: announcementApiData.data[0],
        type: "edit",
        features: features,
        req: req,
        globalImage,
        announcementWeb,
      })
    );
    return;
  });
}
