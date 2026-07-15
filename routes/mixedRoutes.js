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

  function elapsedSeconds(match, event) {
    if (Number.isFinite(event?.capture_time_seconds)) return event.capture_time_seconds;
    if (!match?.started_at || !event?.occurred_at) return null;
    const start = new Date(match.started_at).getTime();
    const occurred = new Date(event.occurred_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(occurred)) return null;
    return Math.max(0, Math.round((occurred - start) / 1000));
  }

  function formatElapsedLabel(totalSeconds) {
    if (!(totalSeconds >= 0)) return null;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function eventUsername(event, role, playersByUuid) {
    const payload = event?.payload || {};
    if (role === "target") {
      return playersByUuid.get(event?.target_uuid)
        || payload.victimUsername
        || payload.victim_username
        || payload.targetUsername
        || payload.target_username
        || event?.target_uuid
        || "Unknown player";
    }
    if (role === "assister") {
      return playersByUuid.get(event?.assister_uuid)
        || event?.assister_username
        || payload.assisterUsername
        || payload.assister_username
        || null;
    }
    return playersByUuid.get(event?.player_uuid)
      || event?.username
      || payload.username
      || payload.killerUsername
      || payload.killer_username
      || payload.playerUsername
      || payload.player_username
      || event?.player_uuid
      || "System";
  }

  function formatTimelineEvent(match, event, playersByUuid) {
    const type = String(event?.event_type || "").toUpperCase();
    const actor = eventUsername(event, "actor", playersByUuid);
    const target = eventUsername(event, "target", playersByUuid);
    const assister = eventUsername(event, "assister", playersByUuid);
    const payload = event?.payload || {};
    const elapsed = formatElapsedLabel(elapsedSeconds(match, event));
    const occurredLabel = event?.occurred_at ? moment(event.occurred_at).format("HH:mm:ss") : "";

    let summary = type;
    if (type === "PLAYER_DEATH") {
      const weapon = event?.weapon || payload.weapon || payload.cause || event?.cause || null;
      summary = `${actor} killed ${target}`;
      if (assister) summary += ` with help from ${assister}`;
      if (weapon) summary += ` using ${weapon}`;
    } else if (type === "OBJECTIVE_EVENT") {
      const objective = event?.objective_name || payload.objectiveName || payload.objective_name || event?.objective_id || "an objective";
      const action = (event?.action || payload.action || "updated").toLowerCase().replace(/_/g, " ");
      summary = `${actor} ${action} ${objective}`;
    } else if (type === "LIVE_FEED_EVENT") {
      summary = payload.message || payload.text || payload.description || `${actor} triggered a live event`;
    } else if (type === "MATCH_STARTED") {
      summary = `Match started on ${match.map_name || match.map_key || "this map"}`;
    } else if (type === "MATCH_ENDED") {
      summary = `Match ended${(match.winners || []).length ? ` - winner: ${(match.winners || []).join(", ")}` : ""}`;
    }

    return {
      ...event,
      elapsedLabel: elapsed,
      occurredLabel,
      summary,
    };
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
    const [live, servers] = await Promise.all([mixed.getLiveMatches(), mixed.listServers()]);
    // Online servers with no running match — shown with their idle/queued map
    // so the page doesn't just say "no active matches" with nothing else.
    const idleServers = servers.filter((s) => s.online && !s.current_match_id);
    return render(res, "modules/mixed/live", await base(req, {
      pageTitle: "Live Matches", pageDescription: "Watch live Mixed matches across all connected servers.",
      live, idleServers,
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
    const gamemodeOptions = [...new Set(
      maps.maps.map((m) => m.gamemode).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    return render(res, "modules/mixed/matches", await base(req, {
      pageTitle: "Match History", pageDescription: "Browse Mixed match history with filters.",
      result, query: req.query, maps: maps.maps, servers, gamemodeOptions,
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
    const playersByUuid = new Map((match.players || []).map((p) => [p.player_uuid, p.username]).filter(([, username]) => username));
    const timeline = [
      ...(match.started_at ? [{
        event_type: "MATCH_STARTED",
        occurred_at: match.started_at,
        payload: {},
      }] : []),
      ...events,
      ...(match.status === "ended" && match.ended_at ? [{
        event_type: "MATCH_ENDED",
        occurred_at: match.ended_at,
        payload: {},
      }] : []),
    ].map((event) => formatTimelineEvent(match, event, playersByUuid));
    return render(res, "modules/mixed/match-detail", await base(req, {
      pageTitle: `Match on ${match.map_name || match.map_key || match.match_id}`,
      pageDescription: `Match detail for ${match.map_name || match.match_id}.`,
      match, events, map, isAdmin, timeline,
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
    const [firstCategory] = mixed.leaderboardCategories();
    return res.redirect(`/mixed/leaderboards/${firstCategory}`);
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
