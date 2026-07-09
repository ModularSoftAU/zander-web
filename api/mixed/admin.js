/**
 * api/mixed/admin.js
 *
 * Admin API for the Mixed module. All endpoints require the zander.web.mixed
 * capability. Token grants/removals and refunds are written to the audit log.
 *
 * NOTE: This module contains NO moderation, punishment or chat-tag tooling —
 * those are intentionally excluded from Mixed.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../../config.json");

import { requireMixedAdmin } from "./auth.js";
import * as mixed from "../../controllers/mixedController.js";
import { generateLog } from "../common.js";
import { broadcast } from "../../lib/mixedRealtime.js";
import { getPublicSourcesInfo } from "../../lib/mixed/mapSyncConfig.js";
import { syncAll, syncSource, SourceNotFoundError } from "../../services/mixed/mixedMapRepoSyncService.js";

export default function mixedAdminRoutes(app) {
  const guard = (handler) => async (req, res) => {
    if (!requireMixedAdmin(req, res)) return;
    try {
      return await handler(req, res);
    } catch (err) {
      console.error("[mixed:admin]", req.url, err);
      if (!res.sent) return res.status(500).send({ success: false, message: `${err.message || err}` });
    }
  };
  const actorId = (req) => req.session?.user?.userId || null;
  const actorName = (req) => req.session?.user?.username || "unknown";

  app.get("/api/admin/mixed/overview", guard(async (_req, res) => {
    return res.send({ success: true, data: await mixed.adminOverview() });
  }));

  // ── Maps ────────────────────────────────────────────────────────────────
  app.patch("/api/admin/mixed/maps/:mapKey", guard(async (req, res) => {
    const map = await mixed.updateMapAdmin(req.params.mapKey, req.body || {});
    return res.send({ success: true, data: map });
  }));

  app.post("/api/admin/mixed/maps/:mapKey/thumbnail", guard(async (req, res) => {
    const { thumbnail_url } = req.body || {};
    if (!thumbnail_url) return res.status(400).send({ success: false, message: "thumbnail_url required." });
    const map = await mixed.updateMapAdmin(req.params.mapKey, { thumbnail_url });
    return res.send({ success: true, data: map });
  }));

  app.post("/api/admin/mixed/maps/:mapKey/ratings/reset", guard(async (req, res) => {
    await mixed.resetMapRatings(req.params.mapKey);
    await generateLog(actorId(req), "reset", "mixed", `Reset ratings for map ${req.params.mapKey}`);
    return res.send({ success: true });
  }));

  // ── Map repo sync ───────────────────────────────────────────────────────
  app.post("/api/admin/mixed/maps/sync", guard(async (req, res) => {
    const summary = await syncAll({ triggeredBy: `admin:${actorId(req)}` });
    await generateLog(actorId(req), "sync", "mixed", `${actorName(req)} triggered a full Mixed map repo sync`);
    broadcast("MAP_SYNC_COMPLETED", summary);
    return res.send({ success: true, data: summary });
  }));

  app.post("/api/admin/mixed/maps/sync/:sourceKey", guard(async (req, res) => {
    try {
      const result = await syncSource(req.params.sourceKey, { triggeredBy: `admin:${actorId(req)}` });
      await generateLog(actorId(req), "sync", "mixed", `${actorName(req)} triggered a sync of Mixed map source ${req.params.sourceKey}`);
      broadcast("MAP_SYNC_COMPLETED", { sources: [result] });
      return res.send({ success: true, data: result });
    } catch (err) {
      if (err instanceof SourceNotFoundError) {
        return res.status(404).send({ success: false, message: err.message });
      }
      throw err;
    }
  }));

  app.get("/api/admin/mixed/maps/sync/status", guard(async (_req, res) => {
    const runs = await mixed.getLatestSyncRunPerSource();
    const conflicts = await mixed.listDuplicateConflicts();
    const placeholders = await mixed.listPlaceholderMaps();
    return res.send({ success: true, data: { runs, conflicts, placeholders } });
  }));

  app.get("/api/admin/mixed/maps/sync/sources", guard(async (_req, res) => {
    return res.send({ success: true, data: getPublicSourcesInfo(config) });
  }));

  app.get("/api/admin/mixed/maps/sync/runs", guard(async (req, res) => {
    const runs = await mixed.listSyncRuns({ sourceKey: req.query?.sourceKey, limit: Number(req.query?.limit) || 50 });
    return res.send({ success: true, data: runs });
  }));

  app.get("/api/admin/mixed/maps/sync/runs/:id/errors", guard(async (req, res) => {
    const errors = await mixed.getSyncRunErrors(Number(req.params.id));
    return res.send({ success: true, data: errors });
  }));

  // ── Voting ──────────────────────────────────────────────────────────────
  app.post("/api/admin/mixed/votes/start", guard(async (req, res) => {
    const { vote_id, server_id, options, metadata } = req.body || {};
    if (!vote_id) return res.status(400).send({ success: false, message: "vote_id required." });
    const vote = await mixed.startVote({ voteId: vote_id, serverId: server_id, options: options || [], metadata });
    broadcast("MAP_VOTE_STARTED", { vote });
    return res.send({ success: true, data: vote });
  }));

  app.post("/api/admin/mixed/votes/:voteId/end", guard(async (req, res) => {
    const vote = await mixed.endVote(req.params.voteId, {
      status: "ended", winningMapKey: req.body?.winning_map_key,
    });
    broadcast("MAP_VOTE_ENDED", { vote });
    return res.send({ success: true, data: vote });
  }));

  app.post("/api/admin/mixed/votes/:voteId/cancel", guard(async (req, res) => {
    const vote = await mixed.endVote(req.params.voteId, { status: "cancelled" });
    broadcast("MAP_VOTE_CANCELLED", { vote });
    return res.send({ success: true, data: vote });
  }));

  app.patch("/api/admin/mixed/voting/settings", guard(async (req, res) => {
    const settings = await mixed.updateSettings(req.body || {});
    return res.send({ success: true, data: settings });
  }));

  // ── Ratings / feedback ────────────────────────────────────────────────────
  app.get("/api/admin/mixed/ratings", guard(async (req, res) => {
    const qy = req.query || {};
    const [overview, feedback] = await Promise.all([
      mixed.ratingsOverview(),
      mixed.listAllFeedback({
        mapKey: qy.map, rating: qy.rating ? Number(qy.rating) : undefined,
        playerUuid: qy.player, matchId: qy.match, limit: 200,
      }),
    ]);
    return res.send({ success: true, data: { overview, feedback } });
  }));

  app.post("/api/admin/mixed/ratings/:ratingId/hide", guard(async (req, res) => {
    await mixed.setFeedbackVisibility(req.params.ratingId, false, req.body?.reason || "Hidden by admin");
    await generateLog(actorId(req), "hide", "mixed", `Hid feedback #${req.params.ratingId}`);
    return res.send({ success: true });
  }));

  app.post("/api/admin/mixed/ratings/:ratingId/remove", guard(async (req, res) => {
    await mixed.deleteRating(req.params.ratingId);
    await generateLog(actorId(req), "delete", "mixed", `Removed feedback #${req.params.ratingId}`);
    return res.send({ success: true });
  }));

  // ── Map Tokens ──────────────────────────────────────────────────────────
  app.get("/api/admin/mixed/map-tokens", guard(async (req, res) => {
    const balances = await mixed.listTokenBalances({ search: req.query?.search, limit: 200 });
    return res.send({ success: true, data: balances });
  }));

  app.post("/api/admin/mixed/map-tokens/grant", guard(async (req, res) => {
    const { player_uuid, username, amount, reason } = req.body || {};
    const amt = Number.parseInt(amount, 10);
    if (!mixed.isValidUuid(player_uuid) || !(amt > 0)) {
      return res.status(400).send({ success: false, message: "Valid player_uuid and positive amount required." });
    }
    const uuid = mixed.normaliseUuid(player_uuid);
    await mixed.creditTokens({ uuid, username, amount: amt, type: "grant", reason: reason || "Admin grant" });
    await generateLog(actorId(req), "grant", "mixed", `${actorName(req)} granted ${amt} Map Tokens to ${uuid} (${reason || "no reason"})`);
    return res.send({ success: true, data: await mixed.getTokenBalance(uuid) });
  }));

  app.post("/api/admin/mixed/map-tokens/remove", guard(async (req, res) => {
    const { player_uuid, amount, reason } = req.body || {};
    const amt = Number.parseInt(amount, 10);
    if (!mixed.isValidUuid(player_uuid) || !(amt > 0)) {
      return res.status(400).send({ success: false, message: "Valid player_uuid and positive amount required." });
    }
    const uuid = mixed.normaliseUuid(player_uuid);
    const result = await mixed.removeTokens({ uuid, amount: amt, type: "remove", reason: reason || "Admin removal" });
    if (!result.ok) return res.status(400).send({ success: false, message: "Player has insufficient balance." });
    await generateLog(actorId(req), "remove", "mixed", `${actorName(req)} removed ${amt} Map Tokens from ${uuid} (${reason || "no reason"})`);
    return res.send({ success: true, data: await mixed.getTokenBalance(uuid) });
  }));

  app.post("/api/admin/mixed/map-requests/:id/refund", guard(async (req, res) => {
    const request = await mixed.getMapRequest(Number(req.params.id));
    if (!request) return res.status(404).send({ success: false, message: "Request not found." });
    if (request.status === "refunded") {
      return res.status(409).send({ success: false, message: "Already refunded." });
    }
    await mixed.refundTokens({ uuid: request.player_uuid, amount: request.token_cost, reason: `Admin refund of request #${request.id}` });
    await mixed.setMapRequestStatus(request.id, "refunded");
    await generateLog(actorId(req), "refund", "mixed", `${actorName(req)} refunded ${request.token_cost} tokens for request #${request.id}`);
    broadcast("MAP_REQUEST_REFUNDED", { id: request.id });
    return res.send({ success: true });
  }));

  app.post("/api/admin/mixed/map-requests/:id/cancel", guard(async (req, res) => {
    const request = await mixed.getMapRequest(Number(req.params.id));
    if (!request) return res.status(404).send({ success: false, message: "Request not found." });
    await mixed.setMapRequestStatus(request.id, "rejected", { failureReason: "Cancelled by admin" });
    return res.send({ success: true });
  }));

  // ── Ranks ───────────────────────────────────────────────────────────────
  app.post("/api/admin/mixed/ranks/sync/:uuid", guard(async (req, res) => {
    if (!mixed.isValidUuid(req.params.uuid)) {
      return res.status(400).send({ success: false, message: "Invalid UUID." });
    }
    await mixed.markRankPendingSync(mixed.normaliseUuid(req.params.uuid));
    return res.send({ success: true, message: "Rank queued for re-sync to zander-pgm." });
  }));

  // ── Entitlements ──────────────────────────────────────────────────────────
  app.get("/api/admin/mixed/entitlements/:uuid", guard(async (req, res) => {
    if (!mixed.isValidUuid(req.params.uuid)) {
      return res.status(400).send({ success: false, message: "Invalid UUID." });
    }
    const entitlements = await mixed.getPlayerEntitlements(mixed.normaliseUuid(req.params.uuid));
    return res.send({ success: true, data: entitlements });
  }));

  app.post("/api/admin/mixed/entitlements/:uuid", guard(async (req, res) => {
    if (!mixed.isValidUuid(req.params.uuid)) {
      return res.status(400).send({ success: false, message: "Invalid UUID." });
    }
    const { entitlement_key, expires_at, username } = req.body || {};
    if (!entitlement_key) return res.status(400).send({ success: false, message: "entitlement_key required." });
    await mixed.addEntitlement({
      uuid: mixed.normaliseUuid(req.params.uuid), username,
      entitlementKey: entitlement_key, expiresAt: expires_at || null,
    });
    await generateLog(actorId(req), "create", "mixed", `${actorName(req)} added entitlement ${entitlement_key} to ${req.params.uuid}`);
    return res.send({ success: true });
  }));

  app.delete("/api/admin/mixed/entitlements/:uuid/:entitlementId", guard(async (req, res) => {
    await mixed.removeEntitlement(mixed.normaliseUuid(req.params.uuid), Number(req.params.entitlementId));
    await generateLog(actorId(req), "delete", "mixed", `${actorName(req)} removed entitlement #${req.params.entitlementId} from ${req.params.uuid}`);
    return res.send({ success: true });
  }));
}
