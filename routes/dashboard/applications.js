import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common";
import { getWebAnnouncement } from "../../controllers/announcementController";

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

  app.get("/dashboard/application/create", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
      return;

    if (!hasPermission("zander.web.application", req, res, features)) return;

    const fetchURL = `${process.env.siteAddress}/api/form/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const formApiData = await response.json();    

    return res.view("dashboard/applications/application-editor", {
      pageTitle: `Dashboard - Application Creator`,
      config: config,
      type: "create",
      features: features,
      req: req,
      formApiData: formApiData,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/application/edit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
      return;

    if (!hasPermission("zander.web.application", req, res, features)) return;

    const applicationId = req.query.applicationId;
    const fetchURL = `${process.env.siteAddress}/api/application/get?id=${applicationId}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const applicationApiData = await response.json();

    const formFetchURL = `${process.env.siteAddress}/api/form/get`;
    const formResponse = await fetch(formFetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const formApiData = await formResponse.json();

    return res.view("dashboard/applications/application-editor", {
      pageTitle: `Dashboard - Application Editor`,
      config: config,
      applicationApiData: applicationApiData.data[0],
      formApiData: formApiData,
      type: "edit",
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
