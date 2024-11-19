import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common";
import { getWebAnnouncement } from "../../controllers/announcementController";

export default function dashboardFormsSiteRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  //
  // Forms
  //
  app.get("/dashboard/forms", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features))
      return;

    if (!hasPermission("zander.web.form", req, res, features)) return;

    const fetchURL = `${process.env.siteAddress}/api/form/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    console.log(apiData);

    res.view("dashboard/forms/form-list", {
      pageTitle: `Dashboard - Forms`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/dashboard/forms/create", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features))
      return;

    if (!hasPermission("zander.web.form", req, res, features)) return;

    res.view("dashboard/forms/form-editor", {
      pageTitle: `Dashboard - Form Creator`,
      config: config,
      type: "create",
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/dashboard/forms/edit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features))
      return;

    if (!hasPermission("zander.web.form", req, res, features)) return;

    const formId = req.query.formId;
    const fetchURL = `${process.env.siteAddress}/api/form/get?id=${formId}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const formApiData = await response.json();

    res.view("dashboard/forms/form-editor", {
      pageTitle: `Dashboard - Form Editor`,
      config: config,
      formApiData: formApiData.data[0],
      type: "edit",
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });
}
