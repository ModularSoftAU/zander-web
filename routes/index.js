import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { getWebAnnouncement } from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common.js";

import dashboardSiteRoutes from "./dashboard/index.js";
import sessionRoutes from "./sessionRoutes.js";
import policySiteRoutes from "./policyRoutes.js";
import redirectSiteRoutes from "./redirectRoutes.js";
import profileSiteRoutes from "./profileRoutes.js";

const rankData = require("../ranks.json");

const SHOP_DIRECTORY_CACHE_TTL = 60 * 1000;
let shopDirectoryCache = {
  payload: null,
  timestamp: 0,
};

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

    return res.view("shopdirectory", {
      pageTitle: `Shop Directory`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/shopdirectory/data", async function (req, res) {
    if (!features?.shopdirectory) {
      return res.status(403).json({
        success: false,
        message: "Shop directory feature is disabled.",
      });
    }

    res.set("Cache-Control", "no-store");

    const refreshRequested = req.query?.refresh === "true";
    const now = Date.now();

    if (
      !refreshRequested &&
      shopDirectoryCache.payload &&
      now - shopDirectoryCache.timestamp < SHOP_DIRECTORY_CACHE_TTL
    ) {
      return res.json(shopDirectoryCache.payload);
    }

    try {
      const shopFetchURL = `${process.env.siteAddress}/api/shop/get`;
      const shopResponse = await fetch(shopFetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });

      const rawBody = await shopResponse.text();
      let parsedBody = null;

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (parseError) {
          console.error("Failed to parse shop directory payload", parseError);
        }
      }

      if (!shopResponse.ok) {
        let errorMessage = "Unable to load shop directory data.";

        if (parsedBody && typeof parsedBody.message === "string") {
          errorMessage = parsedBody.message;
        }

        return res.status(shopResponse.status).json({
          success: false,
          message: errorMessage,
        });
      }

      let shopApiData = parsedBody;
      let parsingWarning = null;

      if (parsedBody === null) {
        parsingWarning =
          "We couldn't read the shop directory data just now. Showing an empty list instead.";
        shopApiData = {
          success: false,
          data: [],
          message: parsingWarning,
        };
      } else if (parsedBody === undefined) {
        shopApiData = {
          success: true,
          data: [],
        };
      } else if (typeof parsedBody !== "object") {
        parsingWarning =
          "We received an unexpected shop directory response. Showing an empty list instead.";
        shopApiData = {
          success: false,
          data: [],
          message: parsingWarning,
        };
      }

      if (shopApiData && typeof shopApiData === "object" && parsingWarning) {
        shopApiData.message = parsingWarning;
      }

      shopDirectoryCache = {
        payload: shopApiData,
        timestamp: Date.now(),
      };
      return res.json(shopApiData);
    } catch (error) {
      console.error("Failed to load shop directory data", error);
      return res.status(503).json({
        success: false,
        message: "We couldn't reach the shop directory service. Please try again shortly.",
      });
    }
  });

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
