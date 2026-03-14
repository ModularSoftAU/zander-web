import { getGlobalImage } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";

export default function policySiteRoute(app, config, features) {
  app.get("/terms", async function (req, res) {
    return res.view("policy/termsOfService", {
      pageTitle: `Network Terms Of Service`,
      pageDescription: `Read the Terms of Service for ${config.siteConfiguration.siteName}. By playing on our network you agree to these terms.`,
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
      pageDescription: `Read the community rules for ${config.siteConfiguration.siteName}. Everyone is expected to follow these guidelines.`,
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
      pageDescription: `Read the Privacy Policy for ${config.siteConfiguration.siteName}. Learn how we collect, use, and protect your data.`,
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
      pageDescription: `Read the Refund Policy for ${config.siteConfiguration.siteName}. Understand our guidelines for purchases and refund requests.`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
