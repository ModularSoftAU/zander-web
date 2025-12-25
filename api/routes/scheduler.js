import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";

export default function schedulerApiRoute(
  app,
  client,
  config,
  db,
  features,
  lang
) {
  const baseEndpoint = "/api/scheduler";

  app.get(baseEndpoint + "/discord/get", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);
    const status = optional(req.query, "status");

    const baseQuery =
      "SELECT s.*, u.username FROM scheduledDiscordMessages s LEFT JOIN users u ON s.createdBy = u.userId";
    const queryParams = [];
    let dbQuery = baseQuery;

    if (status) {
      dbQuery += " WHERE s.status = ?";
      queryParams.push(status);
    }

    dbQuery += " ORDER BY s.scheduledFor ASC";

    db.query(dbQuery, queryParams, function (error, results) {
      if (error) {
        return res.send({
          success: false,
          message: `${error}`,
        });
      }

      if (!results.length) {
        return res.send({
          success: false,
          message: "No scheduled Discord messages found.",
        });
      }

      return res.send({
        success: true,
        data: results,
      });
    });

    return res;
  });

  app.post(baseEndpoint + "/discord/create", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const channelId = required(req.body, "channelId", res);
    const scheduledFor = required(req.body, "scheduledFor", res);
    const embedTitle = optional(req.body, "embedTitle", res);
    const embedDescription = optional(req.body, "embedDescription", res);
    const embedColor = optional(req.body, "embedColor", res);

    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.send({
        success: false,
        message: "Invalid scheduled date/time.",
      });
    }

    db.query(
      `INSERT INTO scheduledDiscordMessages (channelId, embedTitle, embedDescription, embedColor, scheduledFor, createdBy) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        channelId,
        embedTitle,
        embedDescription,
        embedColor,
        scheduledFor,
        actioningUser,
      ],
      function (error) {
        if (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }

        generateLog(
          actioningUser,
          "SUCCESS",
          "SCHEDULER",
          `Scheduled Discord message for channel ${channelId}`,
          res
        );

        return res.send({
          success: true,
          message: "Scheduled Discord message.",
        });
      }
    );

    return res;
  });

  app.post(baseEndpoint + "/discord/delete", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const scheduleId = required(req.body, "scheduleId", res);

    db.query(
      `DELETE FROM scheduledDiscordMessages WHERE scheduleId = ?`,
      [scheduleId],
      function (error) {
        if (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }

        generateLog(
          actioningUser,
          "WARNING",
          "SCHEDULER",
          `Deleted scheduled Discord message ${scheduleId}`,
          res
        );

        return res.send({
          success: true,
          message: "Scheduled message deleted.",
        });
      }
    );

    return res;
  });
}
