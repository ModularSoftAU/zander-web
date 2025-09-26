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
    const apiData = await response.json();

    return res.view("dashboard/applications/application-list", {
      pageTitle: `Dashboard - Applications`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: getGlobalImage(),
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
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/applications/edit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
      return;

    if (!hasPermission("zander.web.application", req, res, features)) return;

    const applicationId = req.query.applicationId;
    const fetchURL = `${process.env.siteAddress}/api/application/get?id=${applicationId}`;

    try {
      const response = await fetch(fetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load application ${applicationId}: ${response.status} ${response.statusText}`
        );
      }

      const responseBody = await response.text();
      if (!responseBody) {
        throw new Error(`Empty payload received for application ${applicationId}`);
      }

      const applicationApiData = JSON.parse(responseBody);
      const applicationRecord = applicationApiData?.data?.[0];

      if (!applicationRecord) {
        throw new Error(`Application ${applicationId} was not returned by the API`);
      }

      return res.view("dashboard/applications/application-editor", {
        pageTitle: `Dashboard - Application Editor`,
        config: config,
        applicationApiData: applicationRecord,
        type: "edit",
        features: features,
        req: req,
        globalImage: getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Application editor load failed", error);
      await setBannerCookie(
        "danger",
        "We couldn't load that application. Please try again.",
        res
      );
      return res.redirect(`/dashboard/applications`);
    }
  });
}
