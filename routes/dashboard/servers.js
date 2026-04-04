import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

export default function dashboardServersSiteRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  const headers = { "x-access-token": process.env.apiKey };

  async function fetchJson(url, fallback = null) {
    try {
      const res = await fetch(url, { headers });
      return await res.json();
    } catch (error) {
      console.error(`[dashboard/servers] fetchJson failed for ${url}:`, error.message);
      return fallback;
    }
  }

  //
  // Servers
  //
  app.get("/dashboard/servers", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.server, req, res, features)) return;

    if (!await hasPermission("zander.web.server", req, res, features)) return;

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(`${process.env.siteAddress}/api/server/get`, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/servers/server-list", {
        pageTitle: `Dashboard - Servers`,
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

  app.get("/dashboard/servers/create", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.server, req, res, features)) return;

    if (!await hasPermission("zander.web.server", req, res, features)) return;

    const [globalImage, announcementWeb] = await Promise.all([
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/servers/server-editor", {
        pageTitle: `Dashboard - Server Creator`,
        config: config,
        type: "create",
        features: features,
        globalImage,
        req: req,
        announcementWeb,
      })
    );
    return;
  });

  app.get("/dashboard/servers/edit", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.server, req, res, features)) return;

    if (!await hasPermission("zander.web.server", req, res, features)) return;

    const id = req.query.id;

    const [serverApiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(`${process.env.siteAddress}/api/server/get?id=${id}`, { data: [{}] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/servers/server-editor", {
        pageTitle: `Dashboard - Server Editor`,
        config: config,
        serverApiData: serverApiData.data[0],
        type: "edit",
        features: features,
        globalImage,
        req: req,
        announcementWeb,
      })
    );
    return;
  });
}
