/**
 * routes/mixedRoutes.js
 *
 * Public-facing Mixed pages (/mixed/*). Pages are server-rendered directly from
 * the mixedController — no self-HTTP round trips. Live/vote/token pages also
 * consume the JSON API (/api/mixed/*) and the SSE stream for live updates.
 */

import { getGlobalImage } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import * as mixed from "../controllers/mixedController.js";
import moment from "moment";

export default function mixedSiteRoutes(app, config, features) {
  const enabled = () => features.mixed !== false;

  async function base(req, extra = {}) {
    const [globalImage, announcementWeb] = await Promise.all([
      getGlobalImage(),
      getWebAnnouncement(),
    ]);
    return {
      config, req, features, moment, globalImage, announcementWeb, ...extra,
    };
  }

  const render = async (res, view, data) =>
    res.header("content-type", "text/html; charset=utf-8").send(await app.view(view, data));

  function guard(req, res) {
    if (enabled()) return true;
    res.redirect("/");
    return false;
  }

  // ── Landing ───────────────────────────────────────────────────────────────
  app.get("/mixed", async (req, res) => {
    if (!guard(req, res)) return;
    const data = await mixed.landingData();
    return render(res, "modules/mixed/index", await base(req, {
      pageTitle: "Mixed", pageDescription: "Mixed — the public PGM stats portal, map browser, leaderboards and Map Token store.",
      ...data,
    }));
  });

  // ── Live ────────────────────────────────────────────────────────────────
  app.get("/mixed/live", async (req, res) => {
    if (!guard(req, res)) return;
    const live = await mixed.getLiveMatches();
    return render(res, "modules/mixed/live", await base(req, {
      pageTitle: "Live Matches", pageDescription: "Watch live Mixed matches across all connected servers.",
      live,
    }));
  });

  // ── Matches ───────────────────────────────────────────────────────────────
  app.get("/mixed/matches", async (req, res) => {
    if (!guard(req, res)) return;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await mixed.listMatches({
      search: req.query.search, mapKey: req.query.map, gamemode: req.query.gamemode,
      serverId: req.query.server, winner: req.query.winner, playerUuid: req.query.player,
      page, limit: 25,
    });
    const [maps, servers] = await Promise.all([mixed.listMaps({ limit: 200 }), mixed.listServers()]);
    return render(res, "modules/mixed/matches", await base(req, {
      pageTitle: "Match History", pageDescription: "Browse Mixed match history with filters.",
      result, query: req.query, maps: maps.maps, servers,
    }));
  });

  app.get("/mixed/matches/:matchId", async (req, res) => {
    if (!guard(req, res)) return;
    const match = await mixed.getMatch(req.params.matchId);
    if (!match) {
      return res
        .status(404)
        .header("content-type", "text/html; charset=utf-8")
        .send(await app.view("session/notFound", await base(req, { pageTitle: "Match not found" })));
    }
    const [events, map] = await Promise.all([
      mixed.getMatchEvents(match.match_id),
      match.map_key ? mixed.getMap(match.map_key) : null,
    ]);
    const isAdmin = Array.isArray(req.session?.user?.permissions) &&
      req.session.user.permissions.some((p) => ["*", "zander.web.*", "zander.web.mixed"].includes(String(p).toLowerCase()));
    return render(res, "modules/mixed/match-detail", await base(req, {
      pageTitle: `Match ${match.match_id}`, pageDescription: `Match detail for ${match.map_name || match.match_id}.`,
      match, events, map, isAdmin,
    }));
  });

  const isAdminViewer = (req) => Array.isArray(req.session?.user?.permissions) &&
    req.session.user.permissions.some((p) => ["*", "zander.web.*", "zander.web.mixed"].includes(String(p).toLowerCase()));

  // ── Maps ────────────────────────────────────────────────────────────────
  app.get("/mixed/maps", async (req, res) => {
    if (!guard(req, res)) return;
    const isAdmin = isAdminViewer(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await mixed.listMaps({
      search: req.query.search, gamemode: req.query.gamemode, author: req.query.author,
      sourceKey: isAdmin ? req.query.source : undefined,
      sort: req.query.sort || "last_played", order: req.query.order || "desc", page, limit: 24,
      includeHidden: isAdmin, includeSourceInfo: isAdmin,
    });
    const settings = await mixed.getSettings();
    return render(res, "modules/mixed/maps", await base(req, {
      pageTitle: "Maps", pageDescription: "Browse Mixed maps, ratings and play stats.",
      result, query: req.query, settings, isAdmin,
    }));
  });

  app.get("/mixed/maps/:mapKey", async (req, res) => {
    if (!guard(req, res)) return;
    const isAdmin = isAdminViewer(req);
    const map = await mixed.getMap(req.params.mapKey, { includeSourceInfo: isAdmin });
    if (!map || (!map.public_visible && !isAdmin)) {
      return res
        .status(404)
        .header("content-type", "text/html; charset=utf-8")
        .send(await app.view("session/notFound", await base(req, { pageTitle: "Map not found" })));
    }
    const settings = await mixed.getSettings();
    const [matchesRes, feedback, voteHistory] = await Promise.all([
      mixed.listMatches({ mapKey: map.map_key, limit: 10 }),
      settings.public_feedback_enabled ? mixed.getMapFeedback(map.map_key, { publicOnly: true, limit: 15 }) : [],
      mixed.getMapVoteHistory(map.map_key, 10),
    ]);
    return render(res, "modules/mixed/map-detail", await base(req, {
      pageTitle: map.name, pageDescription: `${map.name} — map stats, ratings and match history.`,
      map, recentMatches: matchesRes.matches, feedback, voteHistory, isAdmin,
    }));
  });

  // ── Players ───────────────────────────────────────────────────────────────
  app.get("/mixed/players", async (req, res) => {
    if (!guard(req, res)) return;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await mixed.listPlayers({
      search: req.query.search, sort: req.query.sort || "total_xp",
      order: req.query.order || "desc", page, limit: 25,
    });
    return render(res, "modules/mixed/players", await base(req, {
      pageTitle: "Players", pageDescription: "Mixed player rankings and stats.",
      result, query: req.query,
    }));
  });

  app.get("/mixed/players/:uuid", async (req, res) => {
    if (!guard(req, res)) return;
    if (!mixed.isValidUuid(req.params.uuid)) {
      return res
        .status(404)
        .header("content-type", "text/html; charset=utf-8")
        .send(await app.view("session/notFound", await base(req, { pageTitle: "Player not found" })));
    }
    const uuid = mixed.normaliseUuid(req.params.uuid);
    const player = await mixed.getPlayer(uuid);
    if (!player) {
      return res
        .status(404)
        .header("content-type", "text/html; charset=utf-8")
        .send(await app.view("session/notFound", await base(req, { pageTitle: "Player not found" })));
    }
    const viewer = req.session?.user;
    const isSelf = viewer?.uuid && mixed.normaliseUuid(viewer.uuid) === uuid;
    const isAdmin = Array.isArray(viewer?.permissions) &&
      viewer.permissions.some((p) => ["*", "zander.web.*", "zander.web.mixed"].includes(String(p).toLowerCase()));
    const showTokens = isSelf || isAdmin;
    return render(res, "modules/mixed/player-detail", await base(req, {
      pageTitle: player.username || "Player", pageDescription: `${player.username || uuid} — Mixed player profile.`,
      player, showTokens,
    }));
  });

  // ── Leaderboards ───────────────────────────────────────────────────────────
  app.get("/mixed/leaderboards", async (req, res) => {
    if (!guard(req, res)) return;
    return render(res, "modules/mixed/leaderboards", await base(req, {
      pageTitle: "Leaderboards", pageDescription: "Mixed leaderboards across every stat category.",
      categories: mixed.leaderboardCategories(),
    }));
  });

  app.get("/mixed/leaderboards/:category", async (req, res) => {
    if (!guard(req, res)) return;
    const board = await mixed.getLeaderboard(req.params.category, { limit: 100 });
    return render(res, "modules/mixed/leaderboard-detail", await base(req, {
      pageTitle: `Leaderboard — ${req.params.category}`, pageDescription: `Top Mixed players by ${req.params.category}.`,
      board, category: req.params.category, categories: mixed.leaderboardCategories(),
    }));
  });

  // ── Achievements ────────────────────────────────────────────────────────────
  app.get("/mixed/achievements", async (req, res) => {
    return res.redirect("/mixed");
  });

  // ── Servers ─────────────────────────────────────────────────────────────────
  app.get("/mixed/servers", async (req, res) => {
    return res.redirect("/mixed");
  });

  // ── Vote ────────────────────────────────────────────────────────────────────
  app.get("/mixed/vote", async (req, res) => {
    return res.redirect("/mixed");
  });

  // ── Map Tokens ────────────────────────────────────────────────────────────
  app.get("/mixed/map-tokens", async (req, res) => {
    return res.redirect("/webstore");
  });

  // ── Store ───────────────────────────────────────────────────────────────────
  app.get("/mixed/store", async (req, res) => {
    return res.redirect("/webstore");
  });
}
