import { createRequire } from "module";
const require = createRequire(import.meta.url);

import {
  getPopupAnnouncements,
  getWebAnnouncement,
} from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage, hasPermission } from "../api/common.js";
import { getTicketsAccessibleByUser } from "../controllers/supportTicketController.js";
import { getStaffPageData } from "../controllers/staffController.js";

import dashboardSiteRoutes from "./dashboard/index.js";
import sessionRoutes from "./sessionRoutes.js";
import policySiteRoutes from "./policyRoutes.js";
import redirectSiteRoutes from "./redirectRoutes.js";
import profileSiteRoutes from "./profileRoutes.js";
import forumSiteRoutes from "./forumRoutes.js";
import supportRoutes from "./support.js";
import notificationRoutes from "./notificationRoutes.js";
import formSiteRoutes from "./formRoutes.js";

const rankData = require("../ranks.json");

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
  forumSiteRoutes(app, client, fetch, moment, config, db, features, lang);
  policySiteRoutes(app, config, features);
  redirectSiteRoutes(app, config, features);
  supportRoutes(app, client, fetch, moment, config, db, features, lang);
  notificationRoutes(app, config, features);
  formSiteRoutes(app, client, fetch, moment, config, db, features, lang);

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

  app.get("/announcement/popup", async function (req, res) {
    if (!features.announcements) {
      return res.send({
        success: false,
        message: "Announcements disabled.",
      });
    }

    const popupAnnouncements = await getPopupAnnouncements();

    return res.send({
      success: popupAnnouncements.length > 0,
      data: popupAnnouncements,
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
  // Staff
  //
  app.get("/staff", async function (req, res) {
    try {
      const staffData = await getStaffPageData();

      return res.view("staff", {
        pageTitle: `Staff`,
        config: config,
        req: req,
        staffData: staffData,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (err) {
      console.error("Error loading staff page:", err);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading staff page",
        config: config,
        req: req,
        error: err,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
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
  // Punishment Appeals
  //
  app.get("/appeal", async function (req, res) {
    try {
      const isLoggedIn = Boolean(req.session.user);
      let appealPunishmentsApiData = { success: true, data: [] };
      let appealTicketsByKey = {};

      if (isLoggedIn) {
        const fetchPunishmentsURL = `${process.env.siteAddress}/api/user/punishments?username=${encodeURIComponent(
          req.session.user.username
        )}`;
        const punishmentsResponse = await fetch(fetchPunishmentsURL, {
          headers: { "x-access-token": process.env.apiKey },
        });
        appealPunishmentsApiData = await punishmentsResponse.json();

        const userRankSlugs =
          req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
        const tickets = await getTicketsAccessibleByUser(
          req.session.user.userId,
          userRankSlugs
        );
        appealTicketsByKey = (tickets || []).reduce((acc, ticket) => {
          if (ticket.status === "closed") {
            return acc;
          }
          const match = String(ticket.title || "").match(/Appeal #([^\s]+)/);
          if (match && match[1]) {
            acc[match[1]] = ticket.ticketId;
          }
          return acc;
        }, {});
      }

      return res.view("modules/appeal/appeal", {
        pageTitle: "Punishment Appeal",
        config: config,
        req: req,
        features: features,
        appealPunishmentsApiData: appealPunishmentsApiData,
        appealTicketsByKey: appealTicketsByKey,
        moment: moment,
        isLoggedIn: isLoggedIn,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config: config,
        req: req,
        error: error,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.get("/appeal/start", async function (req, res) {
    try {
      if (!req.session.user) {
        const returnTo = encodeURIComponent(req.url);
        return res.redirect(`/login?returnTo=${returnTo}`);
      }

      const punishmentIndex = Number.parseInt(req.query.punishmentIndex, 10);
      if (!Number.isInteger(punishmentIndex) || punishmentIndex < 0) {
        return res.redirect("/appeal");
      }

      const fetchPunishmentsURL = `${process.env.siteAddress}/api/user/punishments?username=${encodeURIComponent(
        req.session.user.username
      )}`;
      const punishmentsResponse = await fetch(fetchPunishmentsURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const appealPunishmentsApiData = await punishmentsResponse.json();
      const punishments = Array.isArray(appealPunishmentsApiData.data)
        ? appealPunishmentsApiData.data
        : [];
      const punishment = punishments[punishmentIndex];

      if (!punishment) {
        return res.redirect("/appeal");
      }

      const fallbackKey = moment(punishment.dateStart).isValid()
        ? `${punishment.type || "unknown"}-${moment(punishment.dateStart).valueOf()}`
        : String(punishmentIndex);
      const punishmentKey = String(
        punishment.id || punishment.punishmentId || punishment.punishment_id || fallbackKey
      );
      const userRankSlugs =
        req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
      const tickets = await getTicketsAccessibleByUser(
        req.session.user.userId,
        userRankSlugs
      );
      const existingTicket = (tickets || []).find((ticket) => {
        if (ticket.status === "closed") return false;
        return String(ticket.title || "").includes(`Appeal #${punishmentKey}`);
      });
      if (existingTicket) {
        return res.redirect(`/support/ticket/${existingTicket.ticketId}`);
      }

      return res.view("modules/appeal/appeal-form", {
        pageTitle: "Punishment Appeal",
        config: config,
        req: req,
        features: features,
        punishmentIndex: punishmentIndex,
        punishmentKey: punishmentKey,
        punishment: punishment,
        moment: moment,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config: config,
        req: req,
        error: error,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
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
  })

  // Proxy endpoint for client-side shop search (avoids exposing API key)
  app.get("/shopdirectory/search", async function (req, res) {
    isFeatureWebRouteEnabled(features.shopdirectory, req, res, features);

    const material = req.query.material || "";
    const page = req.query.page || "1";
    const shopFetchURL = `${process.env.siteAddress}/api/shop/get?material=${encodeURIComponent(material)}&page=${encodeURIComponent(page)}`;

    try {
      const shopResponse = await fetch(shopFetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const shopApiData = await shopResponse.json();
      return res.send(shopApiData);
    } catch (err) {
      console.error("Shop search proxy error:", err);
      return res.send({
        success: false,
        message: "Failed to fetch shop data. Please try again.",
      });
    }
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

  //
  // Punishments
  //
  app.get("/punishments", async function (req, res) {
    const permissionBoolean = await hasPermission(
      "zander.web.punishment.view",
      req,
      res,
      features
    );

    if (!permissionBoolean) return;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

    const fetchURL = `${process.env.siteAddress}/api/punishments/get?page=${page}&limit=${limit}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("modules/punishments/punishments", {
      pageTitle: `Punishments`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      apiData: apiData,
      moment: moment,
    });
  });
}
