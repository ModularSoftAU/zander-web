/**
 * routes/dashboard/wrapped.js
 *
 * Admin UI for Crafting For Christ Wrapped:
 *   - set the period start/end and the on/off switch (persisted in
 *     wrappedSettings; overrides config.json)
 *   - preview your own or any user's Wrapped without persisting a run
 *
 * Rendered under /dashboard/wrapped/* so it reuses the shared admin chrome.
 */

import { hasPermission } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { UserGetter } from "../../controllers/userController.js";
import {
  getWrappedSettings,
  saveWrappedSettings,
  listWrappedRuns,
} from "../../controllers/wrappedController.js";
import {
  getConfiguredWrappedPeriod,
  buildWrappedPreview,
  resolveWrappedPeriod,
} from "../../services/wrapped/wrappedService.js";
import { configWrappedOptions } from "../../lib/wrapped/period.js";
import { renderWrappedCard } from "../../lib/wrapped/card.js";
import {
  pickGlobalBackground,
  musicUrl,
  logoDataUri,
  avatarDataUri,
} from "../../lib/wrapped/pageAssets.js";
import moment from "moment";

const CAP = "zander.web.wrapped";
const MMDD = /^\d{2}-\d{2}$/;

export default function dashboardWrappedRoute(app, config, features, lang) {
  async function shell(req, view, extra) {
    return app.view(view, {
      config,
      features,
      req,
      moment,
      announcementWeb: await getWebAnnouncement(),
      ...adminViewData(req, features),
      ...extra,
    });
  }
  const send = (res, html) =>
    res.header("content-type", "text/html; charset=utf-8").send(html);

  async function resolveUser(username) {
    if (!username) return null;
    const row = await new UserGetter().byUsername(String(username).trim());
    if (!row) return null;
    return { userId: row.userId, username: row.username, uuid: row.uuid };
  }

  // ── Settings + preview launcher ────────────────────────────────────────
  app.get("/dashboard/wrapped", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;

    const [settings, period] = await Promise.all([
      getWrappedSettings(),
      getConfiguredWrappedPeriod(),
    ]);
    const runs = await listWrappedRuns(period.year, 30);

    return send(
      res,
      await shell(req, "dashboard/wrapped/index", {
        pageTitle: "Wrapped",
        settings,
        configDefaults: configWrappedOptions(),
        period,
        runs,
        saved: req.query.saved === "1",
        error: req.query.error || null,
        me: req.session?.user?.username || "",
      })
    );
  });

  app.post("/dashboard/wrapped/settings", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;

    const b = req.body || {};
    const periodStart = String(b.periodStart || "").trim();
    const periodEnd = String(b.periodEnd || "").trim();
    if ((periodStart && !MMDD.test(periodStart)) || (periodEnd && !MMDD.test(periodEnd))) {
      return res.redirect("/dashboard/wrapped?error=Dates+must+be+MM-DD");
    }

    await saveWrappedSettings({
      enabled: b.enabled === "on" || b.enabled === "1" || b.enabled === "true",
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
    });
    return res.redirect("/dashboard/wrapped?saved=1");
  });

  // ── Preview (no persistence) ──────────────────────────────────────────
  app.post("/dashboard/wrapped/preview", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;

    const b = req.body || {};
    const user = await resolveUser(b.username);
    if (!user) return res.redirect("/dashboard/wrapped?error=Unknown+username");

    // Optional per-preview window override.
    let period;
    const ps = String(b.previewStart || "").trim();
    const pe = String(b.previewEnd || "").trim();
    if (ps && pe && MMDD.test(ps) && MMDD.test(pe)) {
      period = resolveWrappedPeriod(new Date(), { enabled: true, periodStart: ps, periodEnd: pe });
    }

    try {
      const payload = await buildWrappedPreview(user, { period });
      req.session.wrappedPreview = { payload, at: Date.now(), username: user.username };
      return res.redirect("/dashboard/wrapped/preview");
    } catch (err) {
      req.log?.error?.({ err }, "[WRAPPED] admin preview failed");
      return res.redirect("/dashboard/wrapped?error=Preview+build+failed");
    }
  });

  app.get("/dashboard/wrapped/preview", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const stash = req.session?.wrappedPreview;
    if (!stash?.payload) return res.redirect("/dashboard/wrapped?error=Run+a+preview+first");

    return send(
      res,
      await app.view("wrapped/show", {
        payload: stash.payload,
        payloadJson: JSON.stringify(stash.payload),
        shared: true,
        preview: true,
        shareUrl: null,
        cardUrl: "/dashboard/wrapped/preview/card.svg",
        bgImage: pickGlobalBackground(),
        musicUrl: musicUrl(),
        siteName: config?.siteConfiguration?.siteName || "Crafting For Christ",
      })
    );
  });

  app.get("/dashboard/wrapped/preview/card.svg", async (req, res) => {
    if (!(await hasPermission(CAP, req, res, features))) return;
    const stash = req.session?.wrappedPreview;
    if (!stash?.payload) return res.status(404).send("no preview");
    const avatar = await avatarDataUri(stash.payload?.user?.uuid || null);
    return res
      .header("content-type", "image/svg+xml; charset=utf-8")
      .send(renderWrappedCard(stash.payload, { logoDataUri: logoDataUri(), avatarDataUri: avatar }));
  });
}
