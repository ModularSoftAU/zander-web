import moment from "moment/moment";
import fetch from "node-fetch";
import { getGlobalImage, hasPermission } from "../../api/common";
import { getWebAnnouncement } from "../../controllers/announcementController";

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
    
    return res.view("dashboard/dashboard-index", {
      pageTitle: `Dashboard`,
      config: config,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
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

    const fetchURL = `${process.env.siteAddress}/api/bridge/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    console.log(apiData);

    res.view("dashboard/bridge", {
      pageTitle: `Dashboard - Bridge`,
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
}
