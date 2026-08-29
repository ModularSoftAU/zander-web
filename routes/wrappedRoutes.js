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
import { readdirSync, readFileSync } from "fs";
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

  // A random site "global" background image, as an absolute asset path so it
  // resolves the same from /wrapped and /wrapped/s/:shareId. null when none.
  function pickGlobalBackground() {
    try {
      const files = readdirSync("./assets/images/globalImages/").filter((f) =>
        /\.(png|jpe?g|webp|gif|avif)$/i.test(f)
      );
      if (!files.length) return null;
      return "/images/globalImages/" + files[Math.floor(Math.random() * files.length)];
    } catch {
      return null;
    }
  }

  // ── self-contained card assets (data URIs so the browser canvas can export) ─
  let logoDataUriCache;
  function logoDataUri() {
    if (logoDataUriCache !== undefined) return logoDataUriCache;
    try {
      const buf = readFileSync("./assets/images/siteLogo.png");
      logoDataUriCache = "data:image/png;base64," + buf.toString("base64");
    } catch {
      logoDataUriCache = null;
    }
    return logoDataUriCache;
  }

  const avatarCache = new Map(); // uuid -> data URI | null
  async function avatarDataUri(uuid) {
    if (!uuid) return null;
    if (avatarCache.has(uuid)) return avatarCache.get(uuid);
    let out = null;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3500);
      const r = await fetch(
        `https://crafthead.net/avatar/${encodeURIComponent(uuid)}?scale=6`,
        { signal: ctl.signal }
      );
      clearTimeout(timer);
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        const type = r.headers.get("content-type") || "image/png";
        out = `data:${type};base64,` + b.toString("base64");
      }
    } catch {
      out = null;
    }
    avatarCache.set(uuid, out);
    return out;
  }

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
      bgImage: pickGlobalBackground(),
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
        return renderHtml(res, "wrapped/intro", {
          siteName,
          year: period.label,
          bgImage: pickGlobalBackground(),
        });
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
    const [avatar] = await Promise.all([
      avatarDataUri(run.payload?.user?.uuid || null),
    ]);
    return res
      .header("content-type", "image/svg+xml; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(renderWrappedCard(run.payload, { logoDataUri: logoDataUri(), avatarDataUri: avatar }));
  });
}
