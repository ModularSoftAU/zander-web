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
  //
  // Announcements
  //
  app.get("/dashboard/announcements", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.announcements, req, res, features)))
      return;

    if (!(await hasPermission("zander.web.announcements", req, res, features))) return;

    const fetchURL = `${process.env.siteAddress}/api/announcement/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    await res.view("dashboard/announcements/announcements-list", {
      pageTitle: `Dashboard - Announcements`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/announcements/create", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.announcements, req, res, features)))
      return;

    if (!(await hasPermission("zander.web.announcements", req, res, features))) return;

    await res.view("dashboard/announcements/announcements-editor", {
      pageTitle: `Dashboard - Announcement Creator`,
      config: config,
      type: "create",
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/announcements/edit", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.announcements, req, res, features)))
      return;

    if (!(await hasPermission("zander.web.announcements", req, res, features))) return;

    const announcementId = req.query.announcementId;
    const fetchURL = `${process.env.siteAddress}/api/announcement/get?announcementId=${announcementId}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const announcementApiData = await response.json();

    await res.view("dashboard/announcements/announcements-editor", {
      pageTitle: `Dashboard - Announcement Editor`,
      config: config,
      announcementApiData: announcementApiData.data[0],
      type: "edit",
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
