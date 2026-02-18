import { optional, required } from "../common.js";
import {
  getPunishmentHistory,
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
        return res.send({
          success: false,
          message: "No valid identifier provided.",
        });
      }

      const punishments = await getDiscordPunishmentsForProfile({
        discordUserId: resolvedDiscordId,
        playerId: resolvedPlayerId,
      });

      return res.send({
        success: true,
        data: punishments,
      });
    } catch (error) {
      console.error("Failed to fetch discord punishments:", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  // Get a specific punishment by ID
  app.get(baseEndpoint + "/punishment", async function (req, res) {
    const id = required(req.query, "id", res);
    if (!id) return;

    try {
      const punishment = await getPunishmentById(parseInt(id, 10));

      if (!punishment) {
        return res.send({
          success: false,
          message: "Punishment not found.",
        });
      }

      return res.send({
        success: true,
        data: punishment,
      });
    } catch (error) {
      console.error("Failed to fetch punishment:", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  // Submit an appeal for a Discord punishment
  app.post(baseEndpoint + "/appeal", async function (req, res) {
    const punishmentId = required(req.body, "punishmentId", res);
    const discordUserId = required(req.body, "discordUserId", res);
    const appealReason = required(req.body, "appealReason", res);
    if (!punishmentId || !discordUserId || !appealReason) return;

    try {
      const punishment = await getPunishmentById(parseInt(punishmentId, 10));
      if (!punishment) {
        return res.send({
          success: false,
          message: "Punishment not found.",
        });
      }

      // Only the target can appeal
      if (punishment.target_discord_user_id !== discordUserId) {
        return res.send({
          success: false,
          message: "You can only appeal your own punishments.",
        });
      }

      // Check if there's already an active appeal
      const existingAppeals = await getAppealsByPunishment(parseInt(punishmentId, 10));
      const pendingAppeal = existingAppeals.find((a) => a.status === "PENDING");
      if (pendingAppeal) {
        return res.send({
          success: false,
          message: "There is already a pending appeal for this punishment.",
        });
      }

      // Cannot appeal if already appealed/lifted/expired
      if (["APPEALED", "EXPIRED", "LIFTED"].includes(punishment.status)) {
        return res.send({
          success: false,
          message: "This punishment is no longer active and cannot be appealed.",
        });
      }

      const appealId = await createAppeal({
        punishmentId: parseInt(punishmentId, 10),
        discordUserId,
        appealReason,
      });

      return res.send({
        success: true,
        data: { appealId },
        message: "Appeal submitted successfully.",
      });
    } catch (error) {
      console.error("Failed to create appeal:", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  // Get pending appeals (staff view)
  app.get(baseEndpoint + "/appeals/pending", async function (req, res) {
    try {
      const appeals = await getPendingAppeals();
      return res.send({
        success: true,
        data: appeals,
      });
    } catch (error) {
      console.error("Failed to fetch pending appeals:", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  // Review an appeal (approve/reject)
  app.post(baseEndpoint + "/appeal/review", async function (req, res) {
    const appealId = required(req.body, "appealId", res);
    const status = required(req.body, "status", res);
    const reviewerDiscordUserId = required(req.body, "reviewerDiscordUserId", res);
    if (!appealId || !status || !reviewerDiscordUserId) return;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.send({
        success: false,
        message: "Status must be APPROVED or REJECTED.",
      });
    }

    const reviewerNotes = optional(req.body, "reviewerNotes");

    try {
      await reviewAppeal({
        appealId: parseInt(appealId, 10),
        status,
        reviewerDiscordUserId,
        reviewerNotes,
      });

      return res.send({
        success: true,
        message: `Appeal ${status.toLowerCase()} successfully.`,
      });
    } catch (error) {
      console.error("Failed to review appeal:", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
