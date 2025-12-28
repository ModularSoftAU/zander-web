import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
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
    if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
      return;

    if (!hasPermission("zander.web.application", req, res, features)) return;

    const fetchURL = `${process.env.siteAddress}/api/application/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await parseApiResponse(response);

    return res.view("dashboard/applications/application-list", {
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
    if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
      return;

    if (!hasPermission("zander.web.application", req, res, features)) return;

    return res.view("dashboard/applications/application-editor", {
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
    if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
      return;

    if (!hasPermission("zander.web.application", req, res, features)) return;

    const applicationId = req.query.applicationId;
    const fetchURL = `${process.env.siteAddress}/api/application/get?id=${applicationId}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const applicationApiData = await parseApiResponse(response);

    return res.view("dashboard/applications/application-editor", {
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
