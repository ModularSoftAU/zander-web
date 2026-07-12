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
import db from "../../controllers/databaseController.js";
import { getProfilePicture } from "../../controllers/userController.js";
import * as mixed from "../../controllers/mixedController.js";
import { getPublicSourcesInfo } from "../../lib/mixed/mapSyncConfig.js";
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
    const [result, sourcesInfo, latestRuns, conflicts, placeholders] = await Promise.all([
      mixed.listMaps({ search: req.query.search, includeHidden: true, includeSourceInfo: true, limit: 100 }),
      Promise.resolve(getPublicSourcesInfo(config)),
      mixed.listSyncRuns({ limit: 20 }),
      mixed.listDuplicateConflicts(),
      mixed.listPlaceholderMaps(),
    ]);
    return send(res, await shell(req, "dashboard/mixed/maps", {
      pageTitle: "Mixed Maps", result, query: req.query,
      sourcesInfo, latestRuns, conflicts, placeholders,
    }));
  });

  app.get("/dashboard/mixed/maps/sync-runs/:id", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const runId = Number(req.params.id);
    const [runs, errors] = await Promise.all([
      mixed.listSyncRuns({ limit: 200 }),
      mixed.getSyncRunErrors(runId),
    ]);
    const run = runs.find((r) => r.id === runId) || null;
    return send(res, await shell(req, "dashboard/mixed/sync-run-detail", { pageTitle: "Mixed Map Sync Run", run, errors }));
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

  app.get("/dashboard/mixed/user-search", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;

    const q = String(req.query?.q || "").trim();
    if (q.length < 2) return res.send({ results: [] });

    try {
      const rows = await new Promise((resolve, reject) => {
        db.query(
          `SELECT userId, username, uuid
             FROM users
            WHERE uuid IS NOT NULL
              AND username LIKE ?
            ORDER BY username ASC
            LIMIT 8`,
          [`${q}%`],
          (error, results) => {
            if (error) return reject(error);
            resolve(results || []);
          }
        );
      });

      const results = await Promise.all(
        rows.map(async (row) => ({
          userId: row.userId,
          username: row.username,
          uuid: row.uuid,
          avatarUrl: await getProfilePicture(row.username),
        }))
      );

      return res.send({ results });
    } catch (error) {
      console.error("[dashboard/mixed] user-search error:", error);
      if (!res.sent) return res.status(500).send({ results: [] });
    }
  });

}
