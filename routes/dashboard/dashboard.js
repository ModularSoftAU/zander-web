import moment from "moment";
import fetch from "node-fetch";
import { getGlobalImage, hasPermission } from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

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

    const announcements = await fetch(
      `${process.env.siteAddress}/api/announcement/get`,
      {
        headers: { "x-access-token": process.env.apiKey },
      }
    ).then((res) => res.json());

    const applications = await fetch(
      `${process.env.siteAddress}/api/application/get`,
      {
        headers: { "x-access-token": process.env.apiKey },
      }
    ).then((res) => res.json());

    const servers = await fetch(
      `${process.env.siteAddress}/api/server/get`,
      {
        headers: { "x-access-token": process.env.apiKey },
      }
    ).then((res) => res.json());

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
    });
  });

  //
  // Logs
  //
  app.get("/dashboard/logs", async function (req, res) {
    if (!hasPermission("zander.web.logs", req, res, features)) return;

    const fetchURL = `${process.env.siteAddress}/api/web/logs/get`;
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
      globalImage: getGlobalImage(),
      moment: moment,
      announcementWeb: await getWebAnnouncement(),
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
      globalImage: getGlobalImage(),
      moment: moment,
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });
}
