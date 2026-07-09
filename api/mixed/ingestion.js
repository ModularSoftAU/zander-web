/**
 * api/mixed/ingestion.js
 *
 * Plugin ingestion endpoints — data pushed FROM zander-pgm INTO zander-web.
 * Every endpoint requires Bearer-token authentication (MIXED_PLUGIN_API_TOKEN).
 *
 *   POST /api/mixed/servers/heartbeat
 *   POST /api/mixed/servers/offline
 *   POST /api/mixed/events
 *   POST /api/mixed/events/batch
 *   POST /api/mixed/stats/player
 *   POST /api/mixed/stats/match
 *   POST /api/mixed/stats/map
 *   POST /api/mixed/xp
 *   POST /api/mixed/achievements
 *   POST /api/mixed/ranks/sync
 *   POST /api/mixed/entitlements/sync
 *   GET  /api/mixed/map-token-requests/pending
 *   POST /api/mixed/map-token-requests/:id/result
 */

import { requirePluginToken } from "./auth.js";
import * as mixed from "../../controllers/mixedController.js";
import { broadcast } from "../../lib/mixedRealtime.js";

export default function mixedIngestionRoutes(app) {
  const guard = (handler) => async (req, res) => {
    if (!requirePluginToken(req, res)) return;
    try {
      return await handler(req, res);
    } catch (err) {
      console.error("[mixed:ingest]", req.url, err);
      if (!res.sent) return res.status(500).send({ success: false, message: `${err.message || err}` });
    }
  };

  app.post("/api/mixed/servers/heartbeat", guard(async (req, res) => {
    const b = req.body || {};
    if (!b.server_id) return res.status(400).send({ success: false, message: "server_id is required." });
    const server = await mixed.upsertServerHeartbeat(b);
    console.info(
      `[mixed:heartbeat] server=${b.server_id} players=${b.onlinePlayers ?? "?"}/${b.maxPlayers ?? "?"} match=${b.currentMatchId || "-"} map=${b.currentMapKey || "-"} queued=${b.queuedEvents ?? 0}`
    );
    broadcast("HEARTBEAT", { server_id: b.server_id, server });
    return res.send({ success: true, data: server });
  }));

  app.post("/api/mixed/servers/offline", guard(async (req, res) => {
    const b = req.body || {};
    if (!b.server_id) return res.status(400).send({ success: false, message: "server_id is required." });
    await mixed.markServerOffline(b.server_id);
    console.info(`[mixed:heartbeat] server=${b.server_id} marked offline.`);
    broadcast("SERVER_OFFLINE", { server_id: b.server_id });
    return res.send({ success: true });
  }));

  async function ingestEvent(e) {
    if (!e || !e.match_id || !e.event_type) return;
    await mixed.insertMatchEvent(e);
    if (["PLAYER_DEATH", "OBJECTIVE_EVENT", "LIVE_FEED_EVENT"].includes(e.event_type)) {
      broadcast(e.event_type, e);
    }
  }

  app.post("/api/mixed/events", guard(async (req, res) => {
    await ingestEvent(req.body);
    return res.send({ success: true });
  }));

  app.post("/api/mixed/events/batch", guard(async (req, res) => {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    for (const e of events) await ingestEvent(e);
    return res.send({ success: true, data: { ingested: events.length } });
  }));

  app.post("/api/mixed/stats/player", guard(async (req, res) => {
    const b = req.body || {};
    if (!mixed.isValidUuid(b.player_uuid)) {
      return res.status(400).send({ success: false, message: "Valid player_uuid is required." });
    }
    b.player_uuid = mixed.normaliseUuid(b.player_uuid);
    const player = await mixed.upsertPlayerTotals(b);
    return res.send({ success: true, data: player });
  }));

  app.post("/api/mixed/stats/match", guard(async (req, res) => {
    const b = req.body || {};
    if (!b.match_id) return res.status(400).send({ success: false, message: "match_id is required." });
    if (b.map_key) await mixed.upsertMap({ map_key: b.map_key, name: b.map_name, gamemode: b.gamemode });
    const match = await mixed.upsertMatch(b);
    const players = Array.isArray(b.players) ? b.players : [];
    for (const p of players) {
      if (mixed.isValidUuid(p.player_uuid)) {
        p.player_uuid = mixed.normaliseUuid(p.player_uuid);
        await mixed.upsertMatchPlayer(b.match_id, p);
      }
    }
    const type = b.status === "ended" ? "MATCH_ENDED" : b.status === "running" ? "MATCH_STARTED" : "MATCH_LOADED";
    broadcast(type, { match_id: b.match_id, match });
    return res.send({ success: true, data: match });
  }));

  app.post("/api/mixed/stats/map", guard(async (req, res) => {
    const b = req.body || {};
    if (!b.map_key) return res.status(400).send({ success: false, message: "map_key is required." });
    await mixed.upsertMap(b);
    const map = await mixed.getMap(b.map_key);
    return res.send({ success: true, data: map });
  }));

  app.post("/api/mixed/xp", guard(async (req, res) => {
    const b = req.body || {};
    if (!mixed.isValidUuid(b.player_uuid)) {
      return res.status(400).send({ success: false, message: "Valid player_uuid is required." });
    }
    await mixed.upsertPlayerTotals({
      player_uuid: mixed.normaliseUuid(b.player_uuid),
      username: b.username,
      level: b.level,
      total_xp: b.total_xp,
    });
    return res.send({ success: true });
  }));

  app.post("/api/mixed/achievements", guard(async (req, res) => {
    const b = req.body || {};
    if (b.achievement) await mixed.upsertAchievement(b.achievement);
    if (b.unlock && mixed.isValidUuid(b.unlock.player_uuid)) {
      await mixed.unlockAchievement(
        mixed.normaliseUuid(b.unlock.player_uuid),
        b.unlock.username,
        b.unlock.achievement_key
      );
    }
    return res.send({ success: true });
  }));

  app.post("/api/mixed/ranks/sync", guard(async (req, res) => {
    const b = req.body || {};
    if (!mixed.isValidUuid(b.player_uuid) || !b.rank_key) {
      return res.status(400).send({ success: false, message: "player_uuid and rank_key required." });
    }
    await mixed.syncPlayerRank({
      uuid: mixed.normaliseUuid(b.player_uuid),
      username: b.username,
      rankKey: b.rank_key,
      expiresAt: b.expires_at || null,
    });
    return res.send({ success: true });
  }));

  app.post("/api/mixed/entitlements/sync", guard(async (req, res) => {
    const b = req.body || {};
    if (!mixed.isValidUuid(b.player_uuid)) {
      return res.status(400).send({ success: false, message: "Valid player_uuid required." });
    }
    await mixed.markEntitlementsSynced(mixed.normaliseUuid(b.player_uuid));
    return res.send({ success: true });
  }));

  // Plugin polls for token-driven map requests to act on in game.
  app.get("/api/mixed/map-token-requests/pending", guard(async (req, res) => {
    const pending = await mixed.listPendingMapRequests(100);
    return res.send({ success: true, data: pending });
  }));

  // Plugin reports the outcome of a map request (applied / rejected / failed).
  app.post("/api/mixed/map-token-requests/:id/result", guard(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const { status, failure_reason } = req.body || {};
    const valid = ["applied", "rejected", "failed", "queued", "expired"];
    if (!valid.includes(status)) {
      return res.status(400).send({ success: false, message: `status must be one of ${valid.join(", ")}` });
    }
    const request = await mixed.getMapRequest(id);
    if (!request) return res.status(404).send({ success: false, message: "Request not found." });

    // Refund the tokens when the plugin could not honour the request.
    if (["rejected", "failed", "expired"].includes(status) && request.status !== "refunded") {
      await mixed.refundTokens({
        uuid: request.player_uuid,
        amount: request.token_cost,
        reason: `Refund for ${request.action_type} on ${request.map_key} (${status})`,
      });
      await mixed.setMapRequestStatus(id, "refunded", { failureReason: failure_reason });
      broadcast("MAP_REQUEST_REFUNDED", { id, request });
    } else {
      await mixed.setMapRequestStatus(id, status, {
        failureReason: failure_reason,
        appliedAt: status === "applied",
      });
      broadcast(`MAP_REQUEST_${status.toUpperCase()}`, { id });
    }
    return res.send({ success: true });
  }));
}
