/**
 * routes/wrappedRoutes.js
 *
 * Crafting For Christ Wrapped — the immersive slide-deck page, the public
 * share link, and the downloadable summary card.
 *
 *   GET  /wrapped                 logged-in user's Wrapped for the current period
 *                                 (?start=1 skips the intro screen)
 *   POST /wrapped/dismiss         "maybe later" — still records the run for the period
 *   GET  /wrapped/s/:shareId      public, no-auth view of a specific run
 *   GET  /wrapped/card/:shareId.svg   summary card (SVG; page rasterises to PNG)
 */

import { createRequire } from "module";
import {
  getConfiguredWrappedPeriod,
  getOrBuildWrapped,
  shouldPromptForWrapped,
  getWrappedRunByShareId,
  markWrappedViewed,
} from "../services/wrapped/wrappedService.js";
import { renderWrappedCard } from "../lib/wrapped/card.js";

const require = createRequire(import.meta.url);
const config = require("../config.json");

const SITE = () => process.env.siteAddress || config?.siteConfiguration?.siteUrl || "";

export default function wrappedSiteRoutes(app, client, fetch, moment, cfg, db, features, lang) {
  const siteName = config?.siteConfiguration?.siteName || "Crafting For Christ";

  function requireLogin(req, res) {
    if (req.session?.user?.userId) return true;
    res.redirect(`/login?returnTo=${encodeURIComponent(req.url)}`);
    return false;
  }

  const renderHtml = async (res, view, data) =>
    res
      .header("content-type", "text/html; charset=utf-8")
      .send(await app.view(view, data));

  function deckData(run, { shared }) {
    return {
      payload: run.payload,
      payloadJson: JSON.stringify(run.payload),
      shared: Boolean(shared),
      shareUrl: `${SITE()}/wrapped/s/${run.shareId}`,
      cardUrl: `/wrapped/card/${run.shareId}.svg`,
      siteName,
    };
  }

  // ── The user's own Wrapped ───────────────────────────────────────────────
  app.get("/wrapped", async function (req, res) {
    if (!requireLogin(req, res)) return;

    const period = await getConfiguredWrappedPeriod();
    if (!period.enabled) return res.redirect("/");

    const user = req.session.user;

    // Intro screen: only before the run exists and only when not explicitly started.
    if (!req.query.start) {
      const pending = await shouldPromptForWrapped(user);
      if (pending) {
        return renderHtml(res, "wrapped/intro", { siteName, year: period.label });
      }
    }

    try {
      const { run } = await getOrBuildWrapped(user);
      await markWrappedViewed(user.userId, period.year);
      if (req.session) delete req.session.wrappedPending;
      return renderHtml(res, "wrapped/show", deckData(run, { shared: false }));
    } catch (err) {
      req.log?.error?.({ err }, "[WRAPPED] build failed");
      return res.status(500).header("content-type", "text/html; charset=utf-8")
        .send("<p>Your Wrapped isn't ready yet. Please try again shortly.</p>");
    }
  });

  // ── "Maybe later" — records the run so we don't prompt again this period ──
  app.post("/wrapped/dismiss", async function (req, res) {
    if (!req.session?.user?.userId) return res.redirect("/login");
    try {
      const { run, period } = await getOrBuildWrapped(req.session.user);
      await markWrappedViewed(req.session.user.userId, period.year);
      void run;
    } catch (err) {
      req.log?.error?.({ err }, "[WRAPPED] dismiss build failed");
    }
    if (req.session) delete req.session.wrappedPending;
    return res.redirect("/");
  });

  // ── Public share view ───────────────────────────────────────────────────
  app.get("/wrapped/s/:shareId", async function (req, res) {
    const run = await getWrappedRunByShareId(req.params.shareId);
    if (!run) {
      return res.status(404).header("content-type", "text/html; charset=utf-8")
        .send("<p>That Wrapped link isn't valid.</p>");
    }
    return renderHtml(res, "wrapped/show", deckData(run, { shared: true }));
  });

  // ── Downloadable summary card ───────────────────────────────────────────
  app.get("/wrapped/card/:shareId.svg", async function (req, res) {
    const run = await getWrappedRunByShareId(req.params.shareId);
    if (!run) return res.status(404).send("not found");
    return res
      .header("content-type", "image/svg+xml; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(renderWrappedCard(run.payload));
  });
}
