import moment from "moment";
import fetch from "node-fetch";
import { getGlobalImage, hasPermission } from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

/** Fetch a URL with the internal API key and parse the JSON response.
 *  Returns `fallback` on any network or parse error instead of throwing. */
async function fetchJson(url, fallback = null) {
  try {
    const res = await fetch(url, {
      headers: { "x-access-token": process.env.apiKey },
    });
    return await res.json();
  } catch (error) {
    console.error(`[dashboard] fetchJson failed for ${url}:`, error.message);
    return fallback;
  }
}

export default function dashboardSiteRoute(app, config, features, lang) {
  //
  // Dashboard
  //
  app.get("/dashboard", async function (req, res) {
    const permissionBoolean = await hasPermission(
      "zander.web.dashboard",
      req,
      res,
      features
    );

    if (!permissionBoolean) return;

    // Run all data fetches and page-chrome lookups concurrently.
    const [announcements, applications, servers, globalImage, announcementWeb] =
      await Promise.all([
        fetchJson(`${process.env.siteAddress}/api/announcement/get`, { data: [] }),
        fetchJson(`${process.env.siteAddress}/api/application/get`, { data: [] }),
        fetchJson(`${process.env.siteAddress}/api/server/get`, { data: [] }),
        getGlobalImage(),
        getWebAnnouncement(),
      ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/dashboard-index", {
        pageTitle: `Dashboard`,
        config: config,
        features: features,
        req: req,
        globalImage,
        announcementWeb,
        announcementsCount: announcements.data ? announcements.data.length : 0,
        applicationsCount: applications.data ? applications.data.length : 0,
        serversCount: servers.data ? servers.data.length : 0,
      })
    );
    return;
  });

  //
  // Logs
  //
  app.get("/dashboard/logs", async function (req, res) {
    if (!await hasPermission("zander.web.logs", req, res, features)) return;

    const queryParams = new URLSearchParams();
    if (req.query?.user) {
      queryParams.set("user", req.query.user);
    }
    if (req.query?.feature) {
      queryParams.set("feature", req.query.feature);
    }
    const fetchURL = `${process.env.siteAddress}/api/web/logs/get${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetchURL, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/logs", {
        pageTitle: `Dashboard - Logs`,
        config: config,
        apiData: apiData,
        features: features,
        req: req,
        globalImage,
        moment: moment,
        announcementWeb,
      })
    );
    return;
  });

  //
  // Bridge
  //
  app.get("/dashboard/bridge", async function (req, res) {
    if (!await hasPermission("zander.web.bridge", req, res, features)) return;

    let pendingTasks = { data: [] };
    let processingTasks = { data: [] };
    let routines = { data: [] };

    try {
      const [pendingResponse, processingResponse, routineResponse] = await Promise.all([
        fetch(`${process.env.siteAddress}/api/bridge/processor/get?status=pending&limit=100`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/api/bridge/processor/get?status=processing&limit=100`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
        fetch(`${process.env.siteAddress}/api/bridge/routine/get`, {
          headers: { "x-access-token": process.env.apiKey },
        }),
      ]);

      [pendingTasks, processingTasks, routines] = await Promise.all([
        pendingResponse.json().catch(() => ({ data: [] })),
        processingResponse.json().catch(() => ({ data: [] })),
        routineResponse.json().catch(() => ({ data: [] })),
      ]);
    } catch (error) {
      console.error("[dashboard/bridge] Failed to fetch bridge data:", error.message);
    }

    const [globalImage, announcementWeb] = await Promise.all([
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/bridge", {
        pageTitle: `Dashboard - Bridge`,
        config: config,
        pendingTasks: pendingTasks,
        processingTasks: processingTasks,
        routines: routines,
        features: features,
        req: req,
        globalImage,
        moment: moment,
        announcementWeb,
      })
    );
    return;
  });
}
