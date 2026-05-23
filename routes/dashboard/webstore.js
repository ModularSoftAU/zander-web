import { hasPermission } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import {
  formatPrice,
  getAllCommands,
  getAllPurchases,
  getAllPurchasesCount,
  getActiveSubscriptionsCount,
  getTotalRevenueCents,
} from "../../controllers/webstoreController.js";

export default function dashboardWebstoreRoute(app, fetch, config, db, features, lang) {

  // GET /dashboard/webstore — overview + purchases list
  app.get("/dashboard/webstore", async function (req, res) {
    if (!await hasPermission("zander.web.webstore", req, res, features)) return;
    if (!features.webstore) return res.redirect("/dashboard");

    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = 20;
    const offset = (page - 1) * limit;

    let purchases = [], totalCount = 0, activeSubscriptions = 0, totalRevenueCents = 0;
    try {
      [purchases, totalCount, activeSubscriptions, totalRevenueCents] = await Promise.all([
        getAllPurchases(limit, offset),
        getAllPurchasesCount(),
        getActiveSubscriptionsCount(),
        getTotalRevenueCents(),
      ]);
    } catch (err) {
      console.error("[dashboard/webstore] failed to load data:", err.message);
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const announcementWeb = await getWebAnnouncement();

    return res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/webstore/index", {
        pageTitle: "Webstore",
        config, features, req, announcementWeb,
        purchases, totalCount, totalPages, page,
        activeSubscriptions, totalRevenueCents,
        formatPrice,
        ...adminViewData(req, features),
      })
    );
  });

  // GET /dashboard/webstore/commands — command configuration
  app.get("/dashboard/webstore/commands", async function (req, res) {
    if (!await hasPermission("zander.web.webstore", req, res, features)) return;
    if (!features.webstore) return res.redirect("/dashboard");

    let commands = [];
    try {
      commands = await getAllCommands();
    } catch (err) {
      console.error("[dashboard/webstore/commands] failed to load:", err.message);
    }

    const announcementWeb = await getWebAnnouncement();

    return res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/webstore/commands", {
        pageTitle: "Webstore — Commands",
        config, features, req, announcementWeb,
        commands,
        ...adminViewData(req, features),
      })
    );
  });
}
