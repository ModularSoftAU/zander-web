/**
 * vote.js — Voting & Reward API routes
 *
 * Public
 *   GET  /vote/sites
 *   GET  /vote/leaderboard?month=YYYY-MM
 *   GET  /vote/player/:uuid?month=YYYY-MM
 *
 * Ingest (requires x-access-token)
 *   POST /vote/ingest
 *
 * Admin (requires x-access-token)
 *   POST   /admin/vote/sites
 *   PUT    /admin/vote/sites/:id
 *   DELETE /admin/vote/sites/:id
 *   GET    /admin/votes?month=YYYY-MM&playerUuid=...
 *   GET    /admin/vote/queue?status=...&playerUuid=...
 *   GET    /admin/vote/monthly/results?month=YYYY-MM
 *   POST   /admin/vote/monthly/process
 *   GET    /admin/vote/reward-templates?type=vote|monthly_top
 *   POST   /admin/vote/reward-templates
 *   PUT    /admin/vote/reward-templates/:id
 *   DELETE /admin/vote/reward-templates/:id
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { isFeatureEnabled, optional } from "../common.js";
import {
  getAllVoteSites,
  getVoteSiteById,
  getVoteSiteByServiceName,
  createVoteSite,
  updateVoteSite,
  deleteVoteSite,
  recordVote,
  upsertMonthlyTotal,
  enqueueCommands,
  getLeaderboard,
  getPlayerMonthlyStats,
  getVoteHistory,
  getQueue,
  getMonthlyWinners,
  monthlyRewardsAlreadyGenerated,
  recordMonthlyResults,
  getMonthlyResults,
  normaliseServiceName,
  buildVoteDedupeKey,
  buildQueueDedupeKey,
  monthKeyFromDate,
  getRewardTemplates,
  getRewardTemplateById,
  createRewardTemplate,
  updateRewardTemplate,
  deleteRewardTemplate,
} from "../../controllers/voteController.js";
import {
  buildVoteRewardCommands,
  buildMonthlyRewardCommands,
} from "../../services/voteRewardService.js";

export default function voteApiRoute(app, config, db, features, lang) {

  // =========================================================================
  // Public: GET /vote/sites
  // =========================================================================
  app.get("/vote/sites", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    try {
      const sites = await getAllVoteSites({ activeOnly: true });
      return res.send({ success: true, data: sites });
    } catch (error) {
      console.error("[vote] GET /vote/sites:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Public: GET /vote/leaderboard?month=YYYY-MM
  // =========================================================================
  app.get("/vote/leaderboard", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const monthKey = optional(req.query, "month") || monthKeyFromDate(new Date());
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.send({ success: false, message: "Invalid month format. Use YYYY-MM." });
    }

    try {
      const board = await getLeaderboard({ monthKey, limit });
      return res.send({ success: true, month: monthKey, data: board });
    } catch (error) {
      console.error("[vote] GET /vote/leaderboard:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Public: GET /vote/player/:uuid?month=YYYY-MM
  // =========================================================================
  app.get("/vote/player/:uuid", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const playerUuid = req.params.uuid;
    const monthKey = optional(req.query, "month") || monthKeyFromDate(new Date());

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.send({ success: false, message: "Invalid month format. Use YYYY-MM." });
    }

    try {
      const stats = await getPlayerMonthlyStats({ playerUuid, monthKey });
      const history = await getVoteHistory({ playerUuid, monthKey, limit: 100 });
      return res.send({
        success: true,
        month: monthKey,
        stats: stats || { vote_count: 0, month_key: monthKey },
        history,
      });
    } catch (error) {
      console.error("[vote] GET /vote/player/:uuid:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Ingest: POST /vote/ingest  (token-authenticated)
  // =========================================================================
  app.post("/vote/ingest", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const playerName = body.playerName;
    const playerUuid = body.playerUuid;
    const serviceNameRaw = body.serviceName;
    const receivedFrom = optional(body, "receivedFrom");
    const receivedAtRaw = optional(body, "receivedAt");

    if (!playerName || !playerUuid || !serviceNameRaw) {
      return res.send({
        success: false,
        message: "playerName, playerUuid, and serviceName are required.",
      });
    }

    const serviceName = normaliseServiceName(serviceNameRaw);
    const receivedAt = receivedAtRaw ? new Date(receivedAtRaw) : new Date();

    if (isNaN(receivedAt.getTime())) {
      return res.send({ success: false, message: "Invalid receivedAt timestamp." });
    }

    try {
      // 1. Validate against an active site
      const site = await getVoteSiteByServiceName(serviceName);
      if (!site) {
        return res.send({ success: false, message: `Unknown voting service: '${serviceName}'.` });
      }
      if (!site.is_active) {
        return res.send({ success: false, message: `Voting service '${serviceName}' is currently inactive.` });
      }

      // 2. Deduplicate
      const dedupeKey = buildVoteDedupeKey(playerUuid, serviceName, receivedAt);
      // recordVote will throw a duplicate-key error if already exists
      let voteId;
      try {
        voteId = await recordVote({
          voteSiteId: site.id,
          playerUuid,
          playerName,
          serviceName,
          receivedFrom,
          receivedAt,
        });
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.send({ success: false, message: "Duplicate vote delivery ignored." });
        }
        throw err;
      }

      // 3. Update monthly total
      const monthKey = monthKeyFromDate(receivedAt);
      await upsertMonthlyTotal({ playerUuid, playerName, monthKey, voteAt: receivedAt });

      // 4. Generate reward commands
      const voteRewardCmds = await buildVoteRewardCommands({
        playerUuid,
        playerName,
        siteName: site.site_name,
        serviceName,
        voteId,
        receivedAt,
      });
      await enqueueCommands(voteRewardCmds);

      return res.send({
        success: true,
        message: `Vote recorded for ${playerName} on ${site.site_name}.`,
        data: {
          voteId,
          monthKey,
          commandsQueued: voteRewardCmds.length,
        },
      });
    } catch (error) {
      console.error("[vote] POST /vote/ingest:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: POST /admin/vote/sites
  // =========================================================================
  app.post("/admin/vote/sites", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const siteName = body.siteName;
    const serviceName = body.serviceName;
    const voteUrl = body.voteUrl;

    if (!siteName || !serviceName || !voteUrl) {
      return res.send({ success: false, message: "siteName, serviceName, and voteUrl are required." });
    }

    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;
    const displayOrder = parseInt(body.displayOrder, 10) || 0;

    try {
      // Check for duplicate service name
      const existing = await getVoteSiteByServiceName(serviceName);
      if (existing) {
        return res.send({ success: false, message: `Service name '${normaliseServiceName(serviceName)}' already exists.` });
      }

      const id = await createVoteSite({ siteName, serviceName, voteUrl, isActive, displayOrder });
      const site = await getVoteSiteById(id);
      return res.send({ success: true, message: "Vote site created.", data: site });
    } catch (error) {
      console.error("[vote] POST /admin/vote/sites:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: PUT /admin/vote/sites/:id
  // =========================================================================
  app.put("/admin/vote/sites/:id", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid site id." });

    const body = req.body || {};
    const updates = {};

    if (body.siteName !== undefined) updates.siteName = body.siteName;
    if (body.serviceName !== undefined) updates.serviceName = body.serviceName;
    if (body.voteUrl !== undefined) updates.voteUrl = body.voteUrl;
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.displayOrder !== undefined) updates.displayOrder = parseInt(body.displayOrder, 10) || 0;

    try {
      const site = await getVoteSiteById(id);
      if (!site) return res.send({ success: false, message: "Vote site not found." });

      await updateVoteSite(id, updates);
      const updated = await getVoteSiteById(id);
      return res.send({ success: true, message: "Vote site updated.", data: updated });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.send({ success: false, message: "Another site already uses that service name." });
      }
      console.error("[vote] PUT /admin/vote/sites/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: DELETE /admin/vote/sites/:id
  // =========================================================================
  app.delete("/admin/vote/sites/:id", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid site id." });

    try {
      const deleted = await deleteVoteSite(id);
      if (!deleted) return res.send({ success: false, message: "Vote site not found." });
      return res.send({ success: true, message: "Vote site deleted." });
    } catch (error) {
      console.error("[vote] DELETE /admin/vote/sites/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: GET /admin/vote/sites  (all, including inactive)
  // =========================================================================
  app.get("/admin/vote/sites", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    try {
      const sites = await getAllVoteSites({ activeOnly: false });
      return res.send({ success: true, data: sites });
    } catch (error) {
      console.error("[vote] GET /admin/vote/sites:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: GET /admin/votes?month=YYYY-MM&playerUuid=...
  // =========================================================================
  app.get("/admin/votes", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const monthKey = optional(req.query, "month");
    const playerUuid = optional(req.query, "playerUuid");
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    if (monthKey && !/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.send({ success: false, message: "Invalid month format. Use YYYY-MM." });
    }

    try {
      const history = await getVoteHistory({ playerUuid, monthKey, limit });
      return res.send({ success: true, data: history });
    } catch (error) {
      console.error("[vote] GET /admin/votes:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: GET /admin/vote/queue?status=...&playerUuid=...
  // =========================================================================
  app.get("/admin/vote/queue", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const status = optional(req.query, "status");
    const playerUuid = optional(req.query, "playerUuid");
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const validStatuses = ["pending", "claimed", "completed", "failed"];
    if (status && !validStatuses.includes(status)) {
      return res.send({ success: false, message: `Invalid status. Allowed: ${validStatuses.join(", ")}` });
    }

    try {
      const queue = await getQueue({ status, playerUuid, limit, offset });
      return res.send({ success: true, data: queue });
    } catch (error) {
      console.error("[vote] GET /admin/vote/queue:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: GET /admin/vote/monthly/results?month=YYYY-MM
  // =========================================================================
  app.get("/admin/vote/monthly/results", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const monthKey = optional(req.query, "month");
    if (monthKey && !/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.send({ success: false, message: "Invalid month format. Use YYYY-MM." });
    }

    try {
      const results = await getMonthlyResults({ monthKey });
      return res.send({ success: true, data: results });
    } catch (error) {
      console.error("[vote] GET /admin/vote/monthly/results:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: POST /admin/vote/monthly/process
  // Manually trigger monthly reward generation for a given month.
  // =========================================================================
  app.post("/admin/vote/monthly/process", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const monthKey = body.month;

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.send({ success: false, message: "month (YYYY-MM) is required." });
    }

    try {
      // Idempotency guard
      const alreadyDone = await monthlyRewardsAlreadyGenerated(monthKey);
      if (alreadyDone) {
        return res.send({
          success: false,
          message: `Monthly rewards for ${monthKey} have already been generated.`,
        });
      }

      const winners = await getMonthlyWinners(monthKey);
      if (!winners.length) {
        return res.send({ success: false, message: `No votes found for ${monthKey}.` });
      }

      // Build and enqueue monthly reward commands for each winner.
      const allCommands = [];
      for (const winner of winners) {
        const cmds = await buildMonthlyRewardCommands({
          playerUuid: winner.player_uuid,
          playerName: winner.player_name,
          monthKey,
          voteCount: winner.vote_count,
        });
        allCommands.push(...cmds);
      }
      await enqueueCommands(allCommands);

      // Record the results (idempotent per month+player).
      await recordMonthlyResults(monthKey, winners);

      return res.send({
        success: true,
        message: `Monthly rewards generated for ${monthKey}. ${winners.length} winner(s), ${allCommands.length} command(s) queued.`,
        data: { month: monthKey, winners, commandsQueued: allCommands.length },
      });
    } catch (error) {
      console.error("[vote] POST /admin/vote/monthly/process:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: GET /admin/vote/reward-templates?type=vote|monthly_top
  // =========================================================================
  app.get("/admin/vote/reward-templates", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const rewardType = optional(req.query, "type");
    const validTypes = ["vote", "monthly_top"];
    if (rewardType && !validTypes.includes(rewardType)) {
      return res.send({ success: false, message: `Invalid type. Allowed: ${validTypes.join(", ")}` });
    }

    try {
      const templates = await getRewardTemplates({ rewardType: rewardType || undefined });
      return res.send({ success: true, data: templates });
    } catch (error) {
      console.error("[vote] GET /admin/vote/reward-templates:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: POST /admin/vote/reward-templates
  // =========================================================================
  app.post("/admin/vote/reward-templates", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const { rewardType, commandTemplate, executeAs, serverScope, isActive, displayOrder } = body;

    if (!rewardType || !commandTemplate) {
      return res.send({ success: false, message: "rewardType and commandTemplate are required." });
    }

    const validTypes = ["vote", "monthly_top"];
    if (!validTypes.includes(rewardType)) {
      return res.send({ success: false, message: `Invalid rewardType. Allowed: ${validTypes.join(", ")}` });
    }

    const validExecuteAs = ["console", "player"];
    if (executeAs && !validExecuteAs.includes(executeAs)) {
      return res.send({ success: false, message: `Invalid executeAs. Allowed: ${validExecuteAs.join(", ")}` });
    }

    try {
      const id = await createRewardTemplate({
        rewardType,
        commandTemplate: commandTemplate.trim(),
        executeAs: executeAs || "console",
        serverScope: serverScope || "any",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        displayOrder: parseInt(displayOrder, 10) || 0,
      });
      const created = await getRewardTemplateById(id);
      return res.send({ success: true, message: "Reward template created.", data: created });
    } catch (error) {
      console.error("[vote] POST /admin/vote/reward-templates:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: PUT /admin/vote/reward-templates/:id
  // =========================================================================
  app.put("/admin/vote/reward-templates/:id", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid template id." });

    const body = req.body || {};
    const updates = {};

    if (body.rewardType !== undefined) updates.rewardType = body.rewardType;
    if (body.commandTemplate !== undefined) updates.commandTemplate = body.commandTemplate.trim();
    if (body.executeAs !== undefined) updates.executeAs = body.executeAs;
    if (body.serverScope !== undefined) updates.serverScope = body.serverScope;
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.displayOrder !== undefined) updates.displayOrder = parseInt(body.displayOrder, 10) || 0;

    const validExecuteAs = ["console", "player"];
    if (updates.executeAs && !validExecuteAs.includes(updates.executeAs)) {
      return res.send({ success: false, message: `Invalid executeAs. Allowed: ${validExecuteAs.join(", ")}` });
    }

    try {
      const existing = await getRewardTemplateById(id);
      if (!existing) return res.send({ success: false, message: "Reward template not found." });

      await updateRewardTemplate(id, updates);
      const updated = await getRewardTemplateById(id);
      return res.send({ success: true, message: "Reward template updated.", data: updated });
    } catch (error) {
      console.error("[vote] PUT /admin/vote/reward-templates/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // Admin: DELETE /admin/vote/reward-templates/:id
  // =========================================================================
  app.delete("/admin/vote/reward-templates/:id", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const id = parseInt(req.params.id, 10);
    if (!id) return res.send({ success: false, message: "Invalid template id." });

    try {
      const deleted = await deleteRewardTemplate(id);
      if (!deleted) return res.send({ success: false, message: "Reward template not found." });
      return res.send({ success: true, message: "Reward template deleted." });
    } catch (error) {
      console.error("[vote] DELETE /admin/vote/reward-templates/:id:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });
}
