import { optional, required } from "../common.js";
import {
  getPunishmentById,
  getDiscordPunishmentsForProfile,
  createAppeal,
  getAppealsByPunishment,
  getPendingAppeals,
  reviewAppeal,
} from "../../controllers/discordPunishmentController.js";
import { UserGetter } from "../../controllers/userController.js";

export default function discordPunishmentsApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/discord-punishments";

  // Get Discord punishments for a user (by discordId or playerId)
  app.get(baseEndpoint + "/get", async function (req, res) {
    const discordId = optional(req.query, "discordId");
    const playerId = optional(req.query, "playerId");
    const username = optional(req.query, "username");

    try {
      let resolvedDiscordId = discordId;
      let resolvedPlayerId = playerId ? parseInt(playerId, 10) : null;

      // If username provided, resolve to discordId and playerId
      if (username && !resolvedDiscordId) {
        const userGetter = new UserGetter();
        const user = await userGetter.byUsername(username);
        if (user) {
          resolvedDiscordId = user.discordId || null;
          resolvedPlayerId = user.userId || null;
        }
      }

      if (!resolvedDiscordId && !resolvedPlayerId) {
        res.send({
          success: false,
          message: "No valid identifier provided.",
        }); return;
      }

      const punishments = await getDiscordPunishmentsForProfile({
        discordUserId: resolvedDiscordId,
        playerId: resolvedPlayerId,
      });

      res.send({
        success: true,
        data: punishments,
      }); return;
    } catch (error) {
      console.error("Failed to fetch discord punishments:", error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `${error}`,
        }); return;
      }
    }
  });

  // Get a specific punishment by ID
  app.get(baseEndpoint + "/punishment", async function (req, res) {
    const id = required(req.query, "id", res);
    if (res.sent) return;

    try {
      const punishment = await getPunishmentById(parseInt(id, 10));

      if (!punishment) {
        res.send({
          success: false,
          message: "Punishment not found.",
        }); return;
      }

      res.send({
        success: true,
        data: punishment,
      }); return;
    } catch (error) {
      console.error("Failed to fetch punishment:", error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `${error}`,
        }); return;
      }
    }
  });

  // Submit an appeal for a Discord punishment
  app.post(baseEndpoint + "/appeal", async function (req, res) {
    const punishmentId = required(req.body, "punishmentId", res);
    if (res.sent) return;
    const discordUserId = required(req.body, "discordUserId", res);
    if (res.sent) return;
    const appealReason = required(req.body, "appealReason", res);
    if (res.sent) return;

    try {
      const punishment = await getPunishmentById(parseInt(punishmentId, 10));
      if (!punishment) {
        res.send({
          success: false,
          message: "Punishment not found.",
        }); return;
      }

      // Only the target can appeal
      if (punishment.target_discord_user_id !== discordUserId) {
        res.send({
          success: false,
          message: "You can only appeal your own punishments.",
        }); return;
      }

      // Check if there's already an active appeal
      const existingAppeals = await getAppealsByPunishment(parseInt(punishmentId, 10));
      const pendingAppeal = existingAppeals.find((a) => a.status === "PENDING");
      if (pendingAppeal) {
        res.send({
          success: false,
          message: "There is already a pending appeal for this punishment.",
        }); return;
      }

      // Cannot appeal if already appealed/lifted/expired
      if (["APPEALED", "EXPIRED", "LIFTED"].includes(punishment.status)) {
        res.send({
          success: false,
          message: "This punishment is no longer active and cannot be appealed.",
        }); return;
      }

      const appealId = await createAppeal({
        punishmentId: parseInt(punishmentId, 10),
        discordUserId,
        appealReason,
      });

      res.send({
        success: true,
        data: { appealId },
        message: "Appeal submitted successfully.",
      }); return;
    } catch (error) {
      console.error("Failed to create appeal:", error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `${error}`,
        }); return;
      }
    }
  });

  // Get pending appeals (staff view)
  app.get(baseEndpoint + "/appeals/pending", async function (req, res) {
    try {
      const appeals = await getPendingAppeals();
      res.send({
        success: true,
        data: appeals,
      }); return;
    } catch (error) {
      console.error("Failed to fetch pending appeals:", error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `${error}`,
        }); return;
      }
    }
  });

  // Review an appeal (approve/reject)
  app.post(baseEndpoint + "/appeal/review", async function (req, res) {
    const appealId = required(req.body, "appealId", res);
    if (res.sent) return;
    const status = required(req.body, "status", res);
    if (res.sent) return;
    const reviewerDiscordUserId = required(req.body, "reviewerDiscordUserId", res);
    if (res.sent) return;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      res.send({
        success: false,
        message: "Status must be APPROVED or REJECTED.",
      }); return;
    }

    const reviewerNotes = optional(req.body, "reviewerNotes");

    try {
      await reviewAppeal({
        appealId: parseInt(appealId, 10),
        status,
        reviewerDiscordUserId,
        reviewerNotes,
      });

      res.send({
        success: true,
        message: `Appeal ${status.toLowerCase()} successfully.`,
      }); return;
    } catch (error) {
      console.error("Failed to review appeal:", error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `${error}`,
        }); return;
      }
    }
  });
}
