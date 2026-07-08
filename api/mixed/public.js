/**
 * api/mixed/public.js
 *
 * Public + logged-in-user API for the Mixed module.
 *
 * Public (no auth):
 *   GET  /api/mixed/live
 *   GET  /api/mixed/matches            GET /api/mixed/matches/:matchId
 *   GET  /api/mixed/maps               GET /api/mixed/maps/:mapKey
 *   GET  /api/mixed/players            GET /api/mixed/players/:uuid
 *   GET  /api/mixed/leaderboards       GET /api/mixed/leaderboards/:category
 *   GET  /api/mixed/achievements       GET /api/mixed/servers
 *   GET  /api/mixed/vote/current       GET /api/mixed/votes/:voteId
 *   GET  /api/mixed/maps/:mapKey/ratings
 *
 * Logged-in + linked Minecraft account required:
 *   POST /api/mixed/vote/cast
 *   POST /api/mixed/maps/:mapKey/ratings
 *   GET  /api/mixed/map-tokens
 *   POST /api/mixed/map-tokens/request
 *   POST /api/mixed/store/checkout
 */

import { requireLinkedUser } from "./auth.js";
import { STORE_PRODUCTS } from "./store.js";
import * as mixed from "../../controllers/mixedController.js";
import { broadcast } from "../../lib/mixedRealtime.js";

const intParam = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

export default function mixedPublicRoutes(app) {
  const wrap = (handler) => async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error("[mixed:public]", req.url, err);
      if (!res.sent) return res.status(500).send({ success: false, message: `${err.message || err}` });
    }
  };

  // ── Live ────────────────────────────────────────────────────────────────
  app.get("/api/mixed/live", wrap(async (_req, res) => {
    return res.send({ success: true, data: await mixed.getLiveMatches() });
  }));

  app.get("/api/mixed/servers", wrap(async (_req, res) => {
    return res.send({ success: true, data: await mixed.listServers() });
  }));

  // ── Matches ───────────────────────────────────────────────────────────────
  app.get("/api/mixed/matches", wrap(async (req, res) => {
    const qy = req.query || {};
    const result = await mixed.listMatches({
      search: qy.search, mapKey: qy.map, gamemode: qy.gamemode, serverId: qy.server,
      winner: qy.winner, playerUuid: qy.player, minDuration: intParam(qy.minDuration),
      maxDuration: intParam(qy.maxDuration), dateFrom: qy.dateFrom, dateTo: qy.dateTo,
      page: intParam(qy.page, 1), limit: Math.min(intParam(qy.limit, 25), 100),
    });
    return res.send({ success: true, ...result });
  }));

  app.get("/api/mixed/matches/:matchId", wrap(async (req, res) => {
    const match = await mixed.getMatch(req.params.matchId);
    if (!match) return res.status(404).send({ success: false, message: "Match not found." });
    return res.send({ success: true, data: match });
  }));

  // ── Maps ────────────────────────────────────────────────────────────────
  app.get("/api/mixed/maps", wrap(async (req, res) => {
    const qy = req.query || {};
    const result = await mixed.listMaps({
      search: qy.search, gamemode: qy.gamemode, author: qy.author,
      sort: qy.sort, order: qy.order,
      page: intParam(qy.page, 1), limit: Math.min(intParam(qy.limit, 24), 60),
    });
    return res.send({ success: true, ...result });
  }));

  app.get("/api/mixed/maps/:mapKey", wrap(async (req, res) => {
    const map = await mixed.getMap(req.params.mapKey);
    if (!map || !map.public_visible) return res.status(404).send({ success: false, message: "Map not found." });
    return res.send({ success: true, data: map });
  }));

  app.get("/api/mixed/maps/:mapKey/ratings", wrap(async (req, res) => {
    const settings = await mixed.getSettings();
    const [totals, feedback] = await Promise.all([
      mixed.getMapRatingTotals(req.params.mapKey),
      settings.public_feedback_enabled
        ? mixed.getMapFeedback(req.params.mapKey, { publicOnly: true, limit: 20 })
        : Promise.resolve([]),
    ]);
    return res.send({ success: true, data: { totals, feedback } });
  }));

  // ── Players ───────────────────────────────────────────────────────────────
  app.get("/api/mixed/players", wrap(async (req, res) => {
    const qy = req.query || {};
    const result = await mixed.listPlayers({
      search: qy.search, sort: qy.sort, order: qy.order,
      page: intParam(qy.page, 1), limit: Math.min(intParam(qy.limit, 25), 100),
    });
    return res.send({ success: true, ...result });
  }));

  app.get("/api/mixed/players/:uuid", wrap(async (req, res) => {
    if (!mixed.isValidUuid(req.params.uuid)) {
      return res.status(400).send({ success: false, message: "Invalid UUID." });
    }
    const player = await mixed.getPlayer(mixed.normaliseUuid(req.params.uuid));
    if (!player) return res.status(404).send({ success: false, message: "Player not found." });
    // token balance only for own profile or admin (handled here by stripping)
    const viewer = req.session?.user;
    const isSelf = viewer?.uuid && mixed.normaliseUuid(viewer.uuid) === player.player_uuid;
    const isAdmin = Array.isArray(viewer?.permissions) &&
      viewer.permissions.some((p) => ["*", "zander.web.*", "zander.web.mixed"].includes(String(p).toLowerCase()));
    if (!isSelf && !isAdmin) delete player.tokenBalance;
    return res.send({ success: true, data: player });
  }));

  // ── Leaderboards ───────────────────────────────────────────────────────────
  app.get("/api/mixed/leaderboards", wrap(async (_req, res) => {
    return res.send({ success: true, data: mixed.leaderboardCategories() });
  }));

  app.get("/api/mixed/leaderboards/:category", wrap(async (req, res) => {
    const board = await mixed.getLeaderboard(req.params.category, {
      limit: Math.min(intParam(req.query.limit, 50), 200),
    });
    return res.send({ success: true, data: board, category: req.params.category });
  }));

  // ── Achievements ────────────────────────────────────────────────────────────
  app.get("/api/mixed/achievements", wrap(async (_req, res) => {
    return res.send({ success: true, data: await mixed.listAchievements() });
  }));

  // ── Voting ──────────────────────────────────────────────────────────────────
  app.get("/api/mixed/vote/current", wrap(async (_req, res) => {
    return res.send({ success: true, data: await mixed.getCurrentVote() });
  }));

  app.get("/api/mixed/votes/:voteId", wrap(async (req, res) => {
    const vote = await mixed.getVote(req.params.voteId);
    if (!vote) return res.status(404).send({ success: false, message: "Vote not found." });
    return res.send({ success: true, data: vote });
  }));

  app.post("/api/mixed/vote/cast", wrap(async (req, res) => {
    const user = requireLinkedUser(req, res);
    if (!user) return;
    const settings = await mixed.getSettings();
    if (!settings.allow_web_voting) {
      return res.status(403).send({ success: false, message: "Web voting is disabled." });
    }
    const { vote_id, map_key } = req.body || {};
    if (!vote_id || !map_key) {
      return res.status(400).send({ success: false, message: "vote_id and map_key required." });
    }
    const result = await mixed.castVote({
      voteId: vote_id, uuid: mixed.normaliseUuid(user.uuid),
      username: user.username, mapKey: map_key, source: "web",
    });
    if (!result.ok) return res.status(409).send({ success: false, message: result.reason });
    const vote = await mixed.getVote(vote_id);
    broadcast("MAP_VOTE_CAST", { vote_id, map_key, vote });
    return res.send({ success: true, data: vote });
  }));

  // ── Ratings ───────────────────────────────────────────────────────────────
  app.post("/api/mixed/maps/:mapKey/ratings", wrap(async (req, res) => {
    const user = requireLinkedUser(req, res);
    if (!user) return;
    const { match_id, rating, feedback } = req.body || {};
    const stars = intParam(rating);
    if (!match_id) return res.status(400).send({ success: false, message: "match_id is required." });
    if (!(stars >= 1 && stars <= 5)) {
      return res.status(400).send({ success: false, message: "rating must be 1–5." });
    }
    const uuid = mixed.normaliseUuid(user.uuid);
    if (!(await mixed.didPlayerPlayMatch(uuid, match_id))) {
      return res.status(403).send({ success: false, message: "You can only rate maps from matches you played." });
    }
    const totals = await mixed.submitRating({
      mapKey: req.params.mapKey, matchId: match_id, uuid,
      username: user.username, rating: stars, feedback,
    });
    broadcast("MAP_RATING_SUBMITTED", { map_key: req.params.mapKey, match_id });
    return res.send({ success: true, data: totals });
  }));

  // ── Map Tokens ────────────────────────────────────────────────────────────
  app.get("/api/mixed/map-tokens", wrap(async (req, res) => {
    const user = requireLinkedUser(req, res);
    if (!user) return;
    const uuid = mixed.normaliseUuid(user.uuid);
    const [balance, transactions, requests] = await Promise.all([
      mixed.getTokenBalance(uuid),
      mixed.getTokenTransactions(uuid, 100),
      mixed.listPlayerMapRequests(uuid, 50),
    ]);
    return res.send({ success: true, data: { balance, transactions, requests } });
  }));

  app.post("/api/mixed/map-tokens/request", wrap(async (req, res) => {
    const user = requireLinkedUser(req, res);
    if (!user) return;
    const { map_key, action_type } = req.body || {};
    const actions = { nominate: "token_nominate_cost", set_next: "token_set_next_cost", sponsor: "token_sponsor_cost" };
    if (!map_key || !actions[action_type]) {
      return res.status(400).send({ success: false, message: "map_key and a valid action_type are required." });
    }
    const map = await mixed.getMap(map_key);
    if (!map) return res.status(404).send({ success: false, message: "Map not found." });
    if (!map.token_enabled || map.blacklisted_from_tokens || !map.public_visible) {
      return res.status(403).send({ success: false, message: "This map is not available for token actions." });
    }
    const settings = await mixed.getSettings();
    const cost = settings[actions[action_type]] || 1;
    const uuid = mixed.normaliseUuid(user.uuid);

    const spend = await mixed.removeTokens({
      uuid, amount: cost, type: "spend",
      reason: `${action_type} on ${map_key}`,
    });
    if (!spend.ok) {
      return res.status(402).send({ success: false, message: "Insufficient Map Token balance." });
    }
    const request = await mixed.createMapRequest({
      uuid, username: user.username, mapKey: map_key, actionType: action_type, tokenCost: cost,
    });
    broadcast("MAP_REQUEST_RECEIVED", { request });
    return res.send({ success: true, data: { request, balance: spend.balance } });
  }));

  // ── Store checkout (Stripe) ─────────────────────────────────────────────────
  app.post("/api/mixed/store/checkout", wrap(async (req, res) => {
    const user = requireLinkedUser(req, res);
    if (!user) return;
    const { product } = req.body || {};
    const item = STORE_PRODUCTS[product];
    if (!item) return res.status(400).send({ success: false, message: "Unknown product." });
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).send({ success: false, message: "Store is not configured." });
    }
    if (!item.stripePriceId) {
      return res.status(503).send({ success: false, message: `No Stripe price configured for ${product}.` });
    }

    const body = new URLSearchParams();
    body.append("mode", item.mode);
    body.append("line_items[0][price]", item.stripePriceId);
    body.append("line_items[0][quantity]", "1");
    body.append("success_url", `${process.env.siteAddress}/mixed/store?success=1&session_id={CHECKOUT_SESSION_ID}`);
    body.append("cancel_url", `${process.env.siteAddress}/mixed/store?canceled=1`);
    body.append("client_reference_id", String(user.userId));
    body.append("metadata[zander_user_id]", String(user.userId));
    body.append("metadata[minecraft_uuid]", mixed.normaliseUuid(user.uuid));
    body.append("metadata[product_type]", "map_tokens");
    body.append("metadata[token_amount]", String(item.tokenAmount));
    body.append("metadata[minecraft_username]", user.username || "");

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("[mixed:store] Stripe error", response.status, text);
      return res.status(502).send({ success: false, message: "Could not start checkout. Please try again." });
    }
    const session = await response.json();
    return res.send({ success: true, data: { url: session.url, id: session.id } });
  }));
}
