/**
 * api/mixed/ingestion.js
 *
 * Plugin ingestion endpoints — data pushed FROM zander-pgm INTO zander-web.
 * Every endpoint requires the app-wide API key (process.env.apiKey), the same
 * one used by every other internal integration — see api/mixed/auth.js.
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

  const serverIdOf = (body = {}) => body.server_id || body.serverId || null;

  app.post("/api/mixed/servers/heartbeat", guard(async (req, res) => {
    const b = req.body || {};
    const serverId = serverIdOf(b);
    if (!serverId) return res.status(400).send({ success: false, message: "server_id is required." });
    const server = await mixed.upsertServerHeartbeat(b);
    console.info(
      `[mixed:heartbeat] server=${serverId} players=${b.onlinePlayers ?? b.playerCount ?? b.player_count ?? "?"}/${b.maxPlayers ?? "?"} match=${b.currentMatchId ?? b.current_match_id ?? "-"} map=${b.currentMapKey ?? b.current_map_key ?? "-"} queued=${b.queuedEvents ?? 0}`
    );
    broadcast("HEARTBEAT", { server_id: serverId, server });
    return res.send({ success: true, data: server });
  }));

  app.post("/api/mixed/servers/offline", guard(async (req, res) => {
    const b = req.body || {};
    const serverId = serverIdOf(b);
    if (!serverId) return res.status(400).send({ success: false, message: "server_id is required." });
    await mixed.markServerOffline(serverId);
    console.info(`[mixed:heartbeat] server=${serverId} marked offline.`);
    broadcast("SERVER_OFFLINE", { server_id: serverId });
    return res.send({ success: true });
  }));

  // The plugin reports kill/death events with killer*/victim* naming; the
  // events table stores the actor generically as player_uuid/target_uuid
  // (player_uuid = killer, target_uuid = victim) so it works for non-kill
  // event types too.
  function normaliseEvent(e) {
    const out = { ...e };
    out.match_id = e.matchId || e.match_id;
    out.event_type = e.type || e.event_type;
    if (e.killerUuid || e.killer_uuid) {
      out.player_uuid = e.killerUuid || e.killer_uuid;
      out.username = e.killerName || e.killerUsername || e.killer_username;
      out.target_uuid = e.victimUuid || e.victim_uuid;
    }
    out.map_key = e.mapKey || e.map_key || null;
    out.assister_uuid = e.assisterUuid || e.assister_uuid || null;
    out.assister_username = e.assisterName || e.assisterUsername || e.assister_username || null;
    out.is_projectile = e.isProjectile ?? e.is_projectile;
    out.is_bow_kill = e.isBowKill ?? e.is_bow_kill;
    out.team_kill = e.teamKill ?? e.team_kill;
    out.objective_type = e.objectiveType || e.objective_type || null;
    out.objective_id = e.objectiveId || e.objective_id || null;
    out.objective_name = e.objectiveName || e.objective_name || null;
    out.capture_time_seconds = e.captureTimeSeconds ?? e.capture_time_seconds ?? null;
    return out;
  }

  async function ingestEvent(rawEvent) {
    const e = normaliseEvent(rawEvent);
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

  // The plugin sends this wrapped as a BridgeEvent: {type, matchId, stats: {uuid,
  // username, matchesPlayed, xpEarned, ...}} with camelCase field names — same
  // envelope shape as MATCH_STATS_SNAPSHOT (see normaliseMatchStats below).
  function normalisePlayerStats(body) {
    const s = body.stats || body;
    return {
      player_uuid: s.uuid || s.player_uuid,
      username: s.username || null,
      level: s.level ?? undefined,
      total_xp: s.xpEarned ?? s.total_xp,
      matches_played: s.matchesPlayed ?? s.matches_played,
      wins: s.wins,
      losses: s.losses,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      objectives: s.objectivesCaptured ?? s.objectives,
      wool_captures: s.woolCaptures ?? s.wool_captures,
      flag_captures: s.flagCaptures ?? s.flag_captures,
      core_leaks: s.coreLeaks ?? s.core_leaks,
      destroyable_damage: s.destroyableDamage ?? s.destroyable_damage,
      control_point_captures: s.controlPointCaptures ?? s.control_point_captures,
      best_killstreak: s.bestKillstreak ?? s.best_killstreak,
      playtime_seconds: s.playtimeSeconds ?? s.playtime_seconds,
    };
  }

  app.post("/api/mixed/stats/player", guard(async (req, res) => {
    const b = normalisePlayerStats(req.body || {});
    if (!mixed.isValidUuid(b.player_uuid)) {
      return res.status(400).send({ success: false, message: "Valid player_uuid is required." });
    }
    b.player_uuid = mixed.normaliseUuid(b.player_uuid);
    const player = await mixed.upsertPlayerTotals(b);
    return res.send({ success: true, data: player });
  }));

  // The plugin sends this wrapped as a BridgeEvent: {type, serverId, ...,
  // stats: {matchId, mapKey, participantCount, totalKills, playerStats: [...]}}
  // with camelCase field names throughout. Normalise both the envelope and
  // the per-player stats down to the snake_case shape the controllers expect.
  function normaliseMatchStats(body) {
    const s = body.stats || body;
    const out = {
      match_id: s.matchId || s.match_id,
      server_id: body.serverId || body.server_id || s.serverId || s.server_id || null,
      map_key: s.mapKey || s.map_key || null,
      map_name: s.mapName || s.map_name || null,
      gamemode: s.gamemode || null,
      status: s.status || "ended",
      started_at: toDate(s.startedAt ?? s.started_at),
      ended_at: toDate(s.endedAt ?? s.ended_at),
      duration_seconds: s.durationSeconds ?? s.duration_seconds ?? null,
      winners: s.winnerTeams || s.winners || null,
      participants_count: s.participantCount ?? s.participants_count,
      total_kills: s.totalKills ?? s.total_kills,
      total_deaths: s.totalDeaths ?? s.total_deaths,
      total_objectives: s.totalObjectives ?? s.total_objectives,
    };
    const playerList = s.playerStats || s.players || [];
    out.players = playerList.map((p) => ({
      player_uuid: p.uuid || p.player_uuid,
      username: p.username || null,
      team_name: p.teamName || p.team_name || null,
      won: p.won ?? false,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      assists: p.assists || 0,
      objectives: p.objectivesCaptured ?? p.objectives ?? 0,
      captures: p.objectivesCaptured ?? p.captures ?? 0,
      wool_captures: p.woolCaptures ?? p.wool_captures ?? 0,
      flag_captures: p.flagCaptures ?? p.flag_captures ?? 0,
      core_leaks: p.coreLeaks ?? p.core_leaks ?? 0,
      destroyable_damage: p.destroyableDamage ?? p.destroyable_damage ?? 0,
      control_point_captures: p.controlPointCaptures ?? p.control_point_captures ?? 0,
      best_killstreak: p.bestKillstreak ?? p.best_killstreak ?? 0,
      longest_shot: p.longestShot ?? p.longest_shot ?? 0,
      furthest_bow_kill: p.furthestBowKill ?? p.furthest_bow_kill ?? 0,
      damage_dealt: p.damageDealt ?? p.damage_dealt ?? 0,
      damage_taken: p.damageTaken ?? p.damage_taken ?? 0,
      xp_earned: p.xpEarned ?? p.xp_earned ?? 0,
    }));
    return out;
  }

  function toDate(ts) {
    if (ts === undefined || ts === null) return null;
    if (ts instanceof Date) return ts;
    return new Date(Number(ts));
  }

  app.post("/api/mixed/stats/match", guard(async (req, res) => {
    const b = normaliseMatchStats(req.body || {});
    if (!b.match_id) return res.status(400).send({ success: false, message: "match_id is required." });
    if (b.map_key) await mixed.upsertPlaceholderMap(b.map_key, { name: b.map_name, gamemode: b.gamemode });
    const match = await mixed.upsertMatch(b);
    for (const p of b.players) {
      if (mixed.isValidUuid(p.player_uuid)) {
        p.player_uuid = mixed.normaliseUuid(p.player_uuid);
        await mixed.upsertMatchPlayer(b.match_id, p, b.status === "ended" ? (b.map_key || null) : null);
      }
    }
    if (b.status === "ended" && b.map_key) {
      const winnerTeam = Array.isArray(b.winners) ? b.winners[0] : null;
      await mixed.recordMapPlay(b.map_key, {
        durationSeconds: b.duration_seconds || 0,
        totalKills: b.total_kills || 0,
        totalObjectives: b.total_objectives || 0,
        winnerTeam,
      });
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
