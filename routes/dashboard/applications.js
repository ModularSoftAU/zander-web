import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
  setBannerCookie,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

export default function dashboardApplicationsSiteRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  const parseApiResponse = async (response) => {
    try {
      const text = await response.text();
      if (!text) {
        return { success: false, message: "Empty response from API." };
      }
      return JSON.parse(text);
    } catch (error) {
      return { success: false, message: "Invalid response from API." };
    }
  };

  //
  // Applications
  //
  app.get("/dashboard/applications", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.applications, req, res, features)))
      return;

    if (!(await hasPermission("zander.web.application", req, res, features))) return;

    const fetchURL = `${process.env.siteAddress}/api/application/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await parseApiResponse(response);

    await res.view("dashboard/applications/application-list", {
      pageTitle: `Dashboard - Applications`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/applications/create", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.applications, req, res, features)))
      return;

    if (!(await hasPermission("zander.web.application", req, res, features))) return;

    await res.view("dashboard/applications/application-editor", {
      pageTitle: `Dashboard - Application Creator`,
      config: config,
      type: "create",
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/applications/edit", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.applications, req, res, features)))
      return;

    if (!(await hasPermission("zander.web.application", req, res, features))) return;

    const applicationId = req.query.applicationId;
    const fetchURL = `${process.env.siteAddress}/api/application/get?id=${applicationId}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const applicationApiData = await parseApiResponse(response);

    if (!applicationApiData.success || !applicationApiData.data?.length) {
      await setBannerCookie("danger", "Application not found.", res);
      { res.redirect("/dashboard/applications"); return; };
    }

    await res.view("dashboard/applications/application-editor", {
      pageTitle: `Dashboard - Application Editor`,
      config: config,
      applicationApiData: applicationApiData.data[0],
      type: "edit",
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
