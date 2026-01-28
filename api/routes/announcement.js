import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";

export default function announcementApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/announcement";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.announcements, res, lang);
    const announcementId = optional(req.query, "announcementId");
    const announcementType = optional(req.query, "announcementType");
    const enabled = optional(req.query, "enabled");

    try {
      function getAnnouncements(dbQuery) {
        db.query(dbQuery, function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results.length) {
            return res.send({
              success: false,
              message: lang.announcement.noAnnouncements,
            });
          }

          res.send({
            success: true,
            data: results,
          });
        });
      }

      const activeWindowFilter =
        " AND (startDate IS NULL OR startDate <= NOW()) AND (endDate IS NULL OR endDate >= NOW())";

      // Get Announcement by specific ID.
      if (announcementId) {
        let dbQuery = `SELECT * FROM announcements WHERE announcementId=${announcementId};`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Get 1 web announcement
      if (announcementType === "web") {
        let dbQuery = `SELECT * FROM announcements WHERE announcementType='web' AND enabled=1${activeWindowFilter} ORDER BY RAND() LIMIT 1;`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Get popup announcements
      if (announcementType === "popup") {
        let dbQuery = `SELECT * FROM announcements WHERE announcementType='popup' AND enabled=1${activeWindowFilter} ORDER BY COALESCE(startDate, updatedDate, NOW()) ASC;`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Get 1 tip announcement
      if (announcementType === "tip") {
        let dbQuery = `SELECT * FROM announcements WHERE announcementType='tip' AND enabled=1${activeWindowFilter} ORDER BY RAND() LIMIT 1;`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Get 1 motd announcement
      if (announcementType === "motd") {
        let dbQuery = `SELECT * FROM announcements WHERE announcementType='motd' AND enabled=1${activeWindowFilter} ORDER BY RAND() LIMIT 1;`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Show all public announcements
      if (enabled === 1) {
        let dbQuery = `SELECT * FROM announcements WHERE enabled=1${activeWindowFilter};`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Show all hidden announcements
      if (enabled === 0) {
        let dbQuery = `SELECT * FROM announcements WHERE enabled=0;`;
        getAnnouncements(dbQuery);
        return res;
      }

      // Show all announcements
      let dbQuery = `SELECT * FROM announcements;`;
      getAnnouncements(dbQuery);
      return res;
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.announcements, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const enabled = required(req.body, "enabled", res);
    const announcementType = required(req.body, "announcementType", res);
    const body = optional(req.body, "body", res);
    const colourMessageFormat = optional(req.body, "colourMessageFormat", res);
    const link = optional(req.body, "link", res);
    const popupButtonText = optional(req.body, "popupButtonText", res);
    const popupImageUrl = optional(req.body, "popupImageUrl", res);
    const startDateRaw = optional(req.body, "startDate", res);
    const endDateRaw = optional(req.body, "endDate", res);
    const timezoneOffset = optional(req.body, "timezoneOffset", res);
    const startDate = normalizeDateTimeInput(
      startDateRaw && startDateRaw.trim() !== "" ? startDateRaw : null,
      timezoneOffset
    );
    const endDate = normalizeDateTimeInput(
      endDateRaw && endDateRaw.trim() !== "" ? endDateRaw : null,
      timezoneOffset
    );

    const now = new Date();

    if (startDate && startDate.getTime() < now.getTime()) {
      return res.send({
        success: false,
        message: "Start date cannot be in the past.",
      });
    }

    if (endDate && endDate.getTime() < now.getTime()) {
      return res.send({
        success: false,
        message: "End date cannot be in the past.",
      });
    }

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      return res.send({
        success: false,
        message: "End date must be after the start date.",
      });
    }

    try {
      db.query(
        `INSERT INTO announcements (enabled, body, announcementType, link, colourMessageFormat, popupButtonText, popupImageUrl, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          enabled,
          body,
          announcementType,
          link,
          colourMessageFormat,
          popupButtonText,
          popupImageUrl,
          startDate ? formatDateTimeForDb(startDate) : null,
          endDate ? formatDateTimeForDb(endDate) : null,
        ],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "SUCCESS",
            "ANNOUNCEMENT",
            `Created ${announcementType}`,
            res
          );

          res.send({
            success: true,
            alertType: "success",
            content: lang.announcement.announcementCreated,
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    isFeatureEnabled(features.announcements, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const announcementId = required(req.body, "announcementId", res);
    const enabled = required(req.body, "enabled", res);
    const announcementType = required(req.body, "announcementType", res);
    const body = optional(req.body, "body", res);
    const colourMessageFormat = optional(req.body, "colourMessageFormat", res);
    const link = optional(req.body, "link", res);
    const popupButtonText = optional(req.body, "popupButtonText", res);
    const popupImageUrl = optional(req.body, "popupImageUrl", res);
    const startDateRaw = optional(req.body, "startDate", res);
    const endDateRaw = optional(req.body, "endDate", res);
    const timezoneOffset = optional(req.body, "timezoneOffset", res);
    const startDate = normalizeDateTimeInput(
      startDateRaw && startDateRaw.trim() !== "" ? startDateRaw : null,
      timezoneOffset
    );
    const endDate = normalizeDateTimeInput(
      endDateRaw && endDateRaw.trim() !== "" ? endDateRaw : null,
      timezoneOffset
    );

    const now = new Date();

    if (startDate && startDate.getTime() < now.getTime()) {
      return res.send({
        success: false,
        message: "Start date cannot be in the past.",
      });
    }

    if (endDate && endDate.getTime() < now.getTime()) {
      return res.send({
        success: false,
        message: "End date cannot be in the past.",
      });
    }

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      return res.send({
        success: false,
        message: "End date must be after the start date.",
      });
    }

    try {
      db.query(
        `
          UPDATE announcements 
              SET 
                  enabled=?,
                  announcementType=?,
                  body=?,
                  colourMessageFormat=?,
                  link=?,
                  popupButtonText=?,
                  popupImageUrl=?,
                  startDate=?,
                  endDate=?
              WHERE announcementId=?;`,
        [
          enabled,
          announcementType,
          body,
          colourMessageFormat,
          link,
          popupButtonText,
          popupImageUrl,
          startDate ? formatDateTimeForDb(startDate) : null,
          endDate ? formatDateTimeForDb(endDate) : null,
          announcementId,
        ],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "SUCCESS",
            "ANNOUNCEMENT",
            `Edited ${announcementId}`,
            res
          );

          return res.send({
            success: true,
            message: lang.announcement.announcementEdited,
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    isFeatureEnabled(features.announcements, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const announcementId = required(req.body, "announcementId", res);

    try {
      db.query(
        `DELETE FROM announcements WHERE announcementId=?;`,
        [announcementId],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "WARNING",
            "ANNOUNCEMENT",
            `Deleted ${announcementId}`,
            res
          );

          return res.send({
            success: true,
            message: lang.announcement.announcementDeleted,
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}

function normalizeDateTimeInput(value, timezoneOffset) {
  if (!value) return null;

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
