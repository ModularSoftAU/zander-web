/**
 * commandBridge.js — Player Reward Command Bridge
 *
 * Consumed by zander-addon to claim and report reward commands.
 *
 *   POST /command-bridge/claim
 *   POST /command-bridge/complete
 *   POST /command-bridge/fail
 */

import { isFeatureEnabled, optional } from "../common.js";
import {
  claimCommands,
  completeCommands,
  failCommands,
} from "../../controllers/voteController.js";

export default function commandBridgeApiRoute(app, config, db, features, lang) {

  // =========================================================================
  // POST /command-bridge/claim
  //
  // Body: { playerUuid, playerName, serverName }
  // Returns pending commands for the player on the specified server, atomically
  // marking them as claimed.
  // =========================================================================
  app.post("/command-bridge/claim", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const playerUuid = body.playerUuid;
    const playerName = body.playerName;
    const serverName = body.serverName;

    if (!playerUuid || !serverName) {
      return res.send({
        success: false,
        message: "playerUuid and serverName are required.",
      });
    }

    try {
      const claimed = await claimCommands({ playerUuid, serverName });

      const commands = claimed.map((row) => ({
        id: row.id,
        command: row.command_text,
        executeAs: row.execute_as,
      }));

      return res.send({ success: true, commands });
    } catch (error) {
      console.error("[command-bridge] POST /command-bridge/claim:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // POST /command-bridge/complete
  //
  // Body: { playerUuid, completedCommandIds: [201, 202, ...] }
  // Marks the specified commands completed.  Only affects rows owned by playerUuid.
  // =========================================================================
  app.post("/command-bridge/complete", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const playerUuid = body.playerUuid;
    const completedCommandIds = body.completedCommandIds;

    if (!playerUuid) {
      return res.send({ success: false, message: "playerUuid is required." });
    }

    if (!Array.isArray(completedCommandIds) || !completedCommandIds.length) {
      return res.send({ success: false, message: "completedCommandIds must be a non-empty array." });
    }

    // Sanitise: only accept integer ids.
    const ids = completedCommandIds
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!ids.length) {
      return res.send({ success: false, message: "No valid command ids provided." });
    }

    try {
      await completeCommands(playerUuid, ids);
      return res.send({ success: true, message: `${ids.length} command(s) marked completed.` });
    } catch (error) {
      console.error("[command-bridge] POST /command-bridge/complete:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // =========================================================================
  // POST /command-bridge/fail
  //
  // Body: { playerUuid, failed: [{ id: 201, reason: "..." }, ...] }
  // Marks the specified commands failed.  Only affects rows owned by playerUuid.
  // =========================================================================
  app.post("/command-bridge/fail", async function (req, res) {
    if (!isFeatureEnabled(features.vote, res, lang)) return;

    const body = req.body || {};
    const playerUuid = body.playerUuid;
    const failed = body.failed;

    if (!playerUuid) {
      return res.send({ success: false, message: "playerUuid is required." });
    }

    if (!Array.isArray(failed) || !failed.length) {
      return res.send({ success: false, message: "failed must be a non-empty array of { id, reason } objects." });
    }

    // Sanitise entries.
    const sanitised = failed
      .map((entry) => ({
        id: parseInt(entry?.id, 10),
        reason: typeof entry?.reason === "string" ? entry.reason.slice(0, 512) : null,
      }))
      .filter((entry) => Number.isFinite(entry.id) && entry.id > 0);

    if (!sanitised.length) {
      return res.send({ success: false, message: "No valid failed entries provided." });
    }

    try {
      await failCommands(playerUuid, sanitised);
      return res.send({ success: true, message: `${sanitised.length} command(s) marked failed.` });
    } catch (error) {
      console.error("[command-bridge] POST /command-bridge/fail:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error}` });
    }
  });
}
