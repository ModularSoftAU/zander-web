/**
 * routes/dashboard/mixed.js
 *
 * Admin pages for the Mixed module. Rendered under /dashboard/mixed/* so they
 * reuse the shared admin chrome (sidebar, permission gating, menu registry).
 * They are the UI for the /api/admin/mixed/* JSON endpoints.
 *
 * Excluded by design: moderation, punishments, chat tags.
 */

import { hasPermission } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import * as mixed from "../../controllers/mixedController.js";
import moment from "moment";

export default function dashboardMixedRoute(app, config, features, lang) {
  const CAP = "zander.web.mixed";

  async function shell(req, view, extra) {
    return app.view(view, {
      config, features, req, moment,
      announcementWeb: await getWebAnnouncement(),
      ...adminViewData(req, features),
      ...extra,
    });
  }
  const send = (res, html) => res.header("content-type", "text/html; charset=utf-8").send(html);

  app.get("/dashboard/mixed", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const overview = await mixed.adminOverview();
    return send(res, await shell(req, "dashboard/mixed/overview", { pageTitle: "Mixed Overview", overview }));
  });

  app.get("/dashboard/mixed/maps", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const result = await mixed.listMaps({ search: req.query.search, includeHidden: true, limit: 100 });
    return send(res, await shell(req, "dashboard/mixed/maps", { pageTitle: "Mixed Maps", result, query: req.query }));
  });

  app.get("/dashboard/mixed/voting", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const [settings, votes] = await Promise.all([mixed.getSettings(), mixed.listVotes(25)]);
    return send(res, await shell(req, "dashboard/mixed/voting", { pageTitle: "Mixed Voting", settings, votes }));
  });

  app.get("/dashboard/mixed/ratings", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const [overview, feedback] = await Promise.all([
      mixed.ratingsOverview(),
      mixed.listAllFeedback({
        mapKey: req.query.map, rating: req.query.rating ? Number(req.query.rating) : undefined,
        playerUuid: req.query.player, matchId: req.query.match, limit: 200,
      }),
    ]);
    return send(res, await shell(req, "dashboard/mixed/ratings", { pageTitle: "Mixed Ratings", overview, feedback, query: req.query }));
  });

  app.get("/dashboard/mixed/map-tokens", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const [balances, settings] = await Promise.all([
      mixed.listTokenBalances({ search: req.query.search, limit: 200 }),
      mixed.getSettings(),
    ]);
    const pending = await mixed.listPendingMapRequests(100);
    return send(res, await shell(req, "dashboard/mixed/map-tokens", { pageTitle: "Mixed Map Tokens", balances, settings, pending, query: req.query }));
  });

  app.get("/dashboard/mixed/ranks", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const [ranks, expiring] = await Promise.all([
      mixed.listPlayerRanks({ search: req.query.search, limit: 200 }),
      mixed.expiringRanks(7),
    ]);
    return send(res, await shell(req, "dashboard/mixed/ranks", { pageTitle: "Mixed Ranks", ranks, expiring, query: req.query }));
  });

  app.get("/dashboard/mixed/entitlements", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    let entitlements = [];
    let lookupUuid = null;
    if (req.query.uuid && mixed.isValidUuid(req.query.uuid)) {
      lookupUuid = mixed.normaliseUuid(req.query.uuid);
      entitlements = await mixed.getPlayerEntitlements(lookupUuid);
    }
    return send(res, await shell(req, "dashboard/mixed/entitlements", { pageTitle: "Mixed Entitlements", entitlements, lookupUuid, query: req.query }));
  });
}
