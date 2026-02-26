import { getGlobalImage } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";

export default function policySiteRoute(app, config, features) {
  app.get("/terms", async function (req, res) {
    { await res.view("policy/termsOfService", {
      pageTitle: `Network Terms Of Service`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    }); return; }
  });

  app.get("/rules", async function (req, res) {
    { await res.view("policy/rules", {
      pageTitle: `Network Rules`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    }); return; }
  });

  app.get("/privacy", async function (req, res) {
    { await res.view("policy/privacy", {
      pageTitle: `Network Privacy Policy`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    }); return; }
  });

  app.get("/refund", async function (req, res) {
    { await res.view("policy/refund", {
      pageTitle: `Network Refund Policy`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    }); return; }
  });
}
