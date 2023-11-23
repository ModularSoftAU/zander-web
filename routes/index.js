import dashboardSiteRoutes from "./dashboard";
import policySiteRoutes from "./policyRoutes";
import sessionRoutes from "./sessionRoutes";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import rankData from "../ranks.json" assert { type: "json" };

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
  policySiteRoutes(app, config, features);

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

    const fetchURL = `${process.env.siteAddress}/api/server/get?visible=true`;
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

    const fetchURL = `https://plugin.tebex.io/community_goals`;
    const response = await fetch(fetchURL, {
      headers: { "X-Tebex-Secret": process.env.tebexSecretKey },
    });
    const communityGoalData = await response.json();

    console.log(communityGoalData);

    return res.view("ranks", {
      pageTitle: `Ranks`,
      config: config,
      req: req,
      communityGoalData: communityGoalData,
      rankData: rankData.categories,
      features: features,
      moment: moment,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Discord Redirect
  //
  app.get("/discord", async function (req, res) {
    return res.redirect(config.siteConfiguration.platforms.discord);
  });

  //
  // Webstore Redirect
  //
  app.get("/webstore", async function (req, res) {
    return res.redirect(config.siteConfiguration.platforms.webstore);
  });

  //
  // Guides Redirect
  //
  app.get("/knowledgebase", async function (req, res) {
    return res.redirect(`https://guides.craftingforchrist.net/`);
  });
}
