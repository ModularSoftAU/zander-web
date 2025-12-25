import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
  hashEmail,
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
      "SELECT s.*, u.username, u.profilePicture_type, u.profilePicture_email, u.uuid FROM scheduledDiscordMessages s LEFT JOIN users u ON s.createdBy = u.userId";
    const queryParams = [];
    let dbQuery = baseQuery;

    if (status) {
      dbQuery += " WHERE s.status = ?";
      queryParams.push(status);
    }

    dbQuery += " ORDER BY s.scheduledFor ASC";

    db.query(dbQuery, queryParams, async function (error, results) {
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

      const enhancedResults = await Promise.all(
        results.map(async (row) => {
          let profilePictureUrl = null;

          if (
            row.profilePicture_type === "GRAVATAR" &&
            row.profilePicture_email
          ) {
            const emailHash = await hashEmail(row.profilePicture_email);
            profilePictureUrl = `https://gravatar.com/avatar/${emailHash}?size=80`;
          }

          if (row.profilePicture_type === "CRAFTATAR" && row.uuid) {
            profilePictureUrl = `https://crafthead.net/helm/${row.uuid}`;
          }

          return {
            ...row,
            profilePictureUrl,
          };
        })
      );

      return res.send({
        success: true,
        data: enhancedResults,
      });
    });

    return res;
  });

  app.post(baseEndpoint + "/discord/create", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const channelId = required(req.body, "channelId", res);
    const scheduledFor = required(req.body, "scheduledFor", res);
    const timezoneOffset = optional(req.body, "timezoneOffset", res);
    const embedTitle = optional(req.body, "embedTitle", res);
    const embedDescription = optional(req.body, "embedDescription", res);
    const embedColor = optional(req.body, "embedColor", res);

    const scheduledDate = normalizeDateTimeInput(
      scheduledFor,
      timezoneOffset
    );
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.send({
        success: false,
        message: "Invalid scheduled date/time.",
      });
    }

    if (scheduledDate.getTime() < Date.now()) {
      return res.send({
        success: false,
        message: "Scheduled time cannot be in the past.",
      });
    }

    db.query(
      `INSERT INTO scheduledDiscordMessages (channelId, embedTitle, embedDescription, embedColor, scheduledFor, createdBy) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        channelId,
        embedTitle,
        embedDescription,
        embedColor,
        formatDateTimeForDb(scheduledDate),
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

function normalizeDateTimeInput(value, timezoneOffset) {
  if (!value) return new Date("");

  const offsetMinutes =
    typeof timezoneOffset === "string" || typeof timezoneOffset === "number"
      ? Number(timezoneOffset)
      : null;

  if (!Number.isNaN(offsetMinutes)) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      const utcMillis =
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute)
        ) +
        offsetMinutes * 60000;
      return new Date(utcMillis);
    }
  }

  return new Date(value);
}

function formatDateTimeForDb(dateValue) {
  return dateValue.toISOString().slice(0, 19).replace("T", " ");
}
