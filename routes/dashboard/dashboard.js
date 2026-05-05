import moment from "moment";
import fetch from "node-fetch";
import { getGlobalImage, hasPermission } from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { adminViewData } from "../../admin/adminHelpers.js";

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

    const apiHeaders = { headers: { "x-access-token": process.env.apiKey } };
    const base = process.env.siteAddress;

    const fetches = [
      fetch(`${base}/api/announcement/get`, apiHeaders).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/application/get`, apiHeaders).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/server/get`, apiHeaders).then((r) => r.json()).catch(() => ({})),
      features.forms
        ? fetch(`${base}/api/form/get`, apiHeaders).then((r) => r.json()).catch(() => ({}))
        : Promise.resolve({}),
    ];

    const [announcements, applications, servers, forms] = await Promise.all(fetches);

    return res.view("dashboard/dashboard-index", {
      pageTitle: `Dashboard`,
      config: config,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      announcementsCount: announcements.data ? announcements.data.length : 0,
      applicationsCount: applications.data ? applications.data.length : 0,
      serversCount: servers.data ? servers.data.length : 0,
      formsCount: forms.data ? forms.data.length : 0,
      recentAnnouncements: Array.isArray(announcements.data) ? announcements.data.slice(0, 5) : [],
      ...adminViewData(req, features),
    });
  });

  //
  // Logs
  //
  app.get("/dashboard/logs", async function (req, res) {
    if (!hasPermission("zander.web.logs", req, res, features)) return;

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
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    res.view("dashboard/logs", {
      pageTitle: `Dashboard - Logs`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      moment: moment,
      announcementWeb: await getWebAnnouncement(),
      ...adminViewData(req, features),
    });

    return res;
  });

  //
  // Bridge
  //
  app.get("/dashboard/bridge", async function (req, res) {
    if (!hasPermission("zander.web.bridge", req, res, features)) return;

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

    const [pendingTasks, processingTasks, routines] = await Promise.all([
      pendingResponse.json(),
      processingResponse.json(),
      routineResponse.json(),
    ]);

    res.view("dashboard/bridge", {
      pageTitle: `Dashboard - Bridge`,
      config: config,
      pendingTasks: pendingTasks,
      processingTasks: processingTasks,
      routines: routines,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      moment: moment,
      announcementWeb: await getWebAnnouncement(),
      ...adminViewData(req, features),
    });

    return res;
  });
}
