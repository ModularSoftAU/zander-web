import dashboardSiteRoutes from "./dashboard";
import policySiteRoutes from "./policyRoutes";
import sessionRoutes from "./sessionRoutes";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import redirectSiteRoutes from "./redirectRoutes";
import rankData from "../ranks.json" assert { type: "json" };
import profileSiteRoutes from "./profileRoutes";

export default function applicationSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  dashboardSiteRoutes(app, client, fetch, moment, config, db, features, lang);
  sessionRoutes(app, client, fetch, moment, config, db, features, lang);
  profileSiteRoutes(app, client, fetch, moment, config, db, features, lang);
  policySiteRoutes(app, config, features);
  redirectSiteRoutes(app, config, features);

  app.get("/", async function (req, res) {
    const fetchURL = `${process.env.siteAddress}/api/web/statistics`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const statApiData = await response.json();

    return res.view("modules/index/index", {
      pageTitle: `${config.siteConfiguration.siteName}`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      statApiData: statApiData,
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Play
  //
  app.get("/play", async function (req, res) {
    isFeatureWebRouteEnabled(features.server, req, res, features);

    const fetchURL = `${process.env.siteAddress}/api/server/get?type=EXTERNAL`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("modules/play/play", {
      pageTitle: `Play`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Apply
  //
  app.get("/apply", async function (req, res) {
    isFeatureWebRouteEnabled(features.applications, req, res, features);

    const fetchURL = `${process.env.siteAddress}/api/application/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("apply", {
      pageTitle: `Apply`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Ranks
  //
  app.get("/ranks", async function (req, res) {
    isFeatureWebRouteEnabled(features.ranks, req, res, features);

    return res.view("ranks", {
      pageTitle: `Ranks`,
      config: config,
      req: req,
      rankData: rankData.categories,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Report
  //
  app.get("/report", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.report, req, res, features)) {
      return;
    }

    if (!req.session.user) {
      return res.view("session/notLoggedIn", {
        pageTitle: `Access Restricted`,
        config: config,
        req: req,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    return res.view("report", {
      pageTitle: `Report`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Shop Directory
  // 
  app.get("/shopdirectory", async function (req, res) {
    isFeatureWebRouteEnabled(features.shopdirectory, req, res, features);

    //
    // Get all Shops
    //
    const shopFetchURL = `${process.env.siteAddress}/api/shop/get`;
    const shopResponse = await fetch(shopFetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const shopApiData = await shopResponse.json();

    console.log(shopApiData.data[0].userData);
    

    return res.view("shopdirectory", {
      pageTitle: `Shop Directory`,
      config: config,
      req: req,
      features: features,
      shopApiData: shopApiData,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  })
  
  //
  // Vault
  //
  app.get("/vault", async function (req, res) {
    isFeatureWebRouteEnabled(features.vault, req, res, features);

    const fetchURL = `${process.env.siteAddress}/api/vault/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("vault", {
      pageTitle: `Vault`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
