import { getGlobalImage } from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";

export default function policySiteRoute(app, config, features) {
  app.get("/terms", async function (req, res) {
    return res.view("policy/termsOfService", {
      pageTitle: `Network Terms Of Service`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/rules", async function (req, res) {
    return res.view("policy/rules", {
      pageTitle: `Network Rules`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/privacy", async function (req, res) {
    return res.view("policy/privacy", {
      pageTitle: `Network Privacy Policy`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/refund", async function (req, res) {
    return res.view("policy/refund", {
      pageTitle: `Network Refund Policy`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
