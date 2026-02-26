import { MessageBuilder, Webhook } from "discord-webhook-node";
import { sendWebhookMessage } from "../../lib/discord/webhooks.mjs";
import {
  isFeatureEnabled,
  required,
  optional,
  setBannerCookie,
} from "../common.js";
import { Colors } from "discord.js";

export default function reportApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/report";

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    if (!isFeatureEnabled(features.report, res, lang)) return;
    const reportedId = optional(req.query, "reportedId");

    try {
      let dbQuery;
      let params = [];

      if (reportedId) {
        dbQuery = "SELECT * FROM reports WHERE reportedId = ?";
        params = [reportedId];
      } else {
        dbQuery = "SELECT * FROM reports";
      }

      const results = await new Promise((resolve, reject) => {
        db.query(dbQuery, params, (error, results) => {
          if (error) return reject(error);
          resolve(results);
        });
      });

      if (!results || !results.length) {
        res.send({
          success: false,
          message: `There are no reports available.`,
        }); return;
      }

      res.send({
        success: true,
        data: results,
      }); return;
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `${error}`,
        }); return;
      }
    }
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!isFeatureEnabled(features.report, res, lang)) return;

    const reporterUser = required(req.body, "reporterUser", res);
    if (res.sent) return;
    const reportedUser = required(req.body, "reportedUser", res);
    if (res.sent) return;
    const reportReason = required(req.body, "reportReason", res);
    if (res.sent) return;
    const reportReasonEvidence = optional(
      req.body,
      "reportReasonEvidence"
    );
    const reportPlatform = required(req.body, "reportPlatform", res);
    if (res.sent) return;

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `
          INSERT INTO
              reports
          (
              reporterId,
              reportedUser,
              reportReason,
              reportReasonEvidence,
              reportPlatform
          ) VALUES ((SELECT userId FROM users WHERE username=?), ?, ?, ?, ?)`,
          [
            reporterUser,
            reportedUser,
            reportReason,
            reportReasonEvidence,
            reportPlatform,
          ],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      await setBannerCookie("success", "Report has been sent.", res);

      const staffChannelHook = new Webhook(
        config.discord.webhooks.staffChannel
      );

      const embed = new MessageBuilder()
        .setTitle(`New Report: ${reportedUser}`)
        .addField("Report Platform", reportPlatform, true)
        .addField("Report By", reporterUser, true)
        .addField("Report Reason", reportReason)
        .setColor(Colors.Red)
        .setTimestamp();

      if (reportReasonEvidence) {
        embed.addField("Report Evidence", reportReasonEvidence);
      }

      const webhookSent = await sendWebhookMessage(
        staffChannelHook,
        embed,
        { context: "api/report#create" }
      );

      if (!webhookSent) {
        res.send({
          success: false,
          message:
            "Report saved, but we couldn't notify staff. Please try again soon.",
        }); return;
      }

      res.send({
        success: true,
        message: `Thanks for your submission: ${reportedUser} for ${reportReason}.`,
      }); return;
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: `Report has failed, please try again later.`,
        }); return;
      }
    }
  });
}
