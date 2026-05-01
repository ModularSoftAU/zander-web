import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";
import {
  getEligibilityRules,
  saveEligibilityRules,
  deleteEligibilityRules,
  checkApplicationEligibility,
  getEligibilitySnapshotByResponse,
  createEligibilityOverride,
  getEligibilityOverrides,
} from "../../controllers/applicationEligibilityController.js";

export default function applicationApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/application";

  app.get(baseEndpoint + "/get", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;
    const applicationId = optional(req.query, "id");

    try {
      let results;
      try {
        results = await new Promise((resolve, reject) => {
          let dbQuery;
          let params = [];
          if (applicationId) {
            dbQuery = `SELECT a.*, f.name as linkedFormName, f.slug as linkedFormSlug, f.status as linkedFormStatus FROM applications a LEFT JOIN forms f ON a.linkedFormId = f.formId WHERE a.applicationId=?;`;
            params = [applicationId];
          } else {
            dbQuery = `SELECT a.*, f.name as linkedFormName, f.slug as linkedFormSlug, f.status as linkedFormStatus FROM applications a LEFT JOIN forms f ON a.linkedFormId = f.formId ORDER BY a.position ASC;`;
          }
          db.query(dbQuery, params, (error, results) => {
            if (error) return reject(error);
            resolve(results);
          });
        });
      } catch (joinError) {
        results = await new Promise((resolve, reject) => {
          const dbQuery = applicationId
            ? `SELECT * FROM applications WHERE applicationId=?;`
            : `SELECT * FROM applications ORDER BY position ASC;`;
          const params = applicationId ? [applicationId] : [];
          db.query(dbQuery, params, (error, results) => {
            if (error) return reject(error);
            resolve(results);
          });
        });
      }

      if (!results || !results.length) {
        return res.send({
          success: false,
          message: lang.applications.noApplicationsFound,
        });
      }

      return res.send({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const actioningUser = required(req.body, "actioningUser", res);
    if (res.sent) return;
    const displayName = required(req.body, "displayName", res);
    if (res.sent) return;
    const description = required(req.body, "description", res);
    if (res.sent) return;
    const displayIcon = required(req.body, "displayIcon", res);
    if (res.sent) return;
    const requirementsMarkdown = required(
      req.body,
      "requirementsMarkdown",
      res
    );
    if (res.sent) return;
    const position = required(req.body, "position", res);
    if (res.sent) return;
    const applicationStatus = required(req.body, "applicationStatus", res);
    if (res.sent) return;

    const applicationType = optional(req.body, "applicationType") || "external";
    const redirectUrl = optional(req.body, "redirectUrl");
    const linkedFormId = optional(req.body, "linkedFormId");

    let applicationCreatedLang = lang.applications.applicationCreated;

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO applications
              (displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position, applicationStatus, applicationType, linkedFormId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            displayName,
            description,
            displayIcon,
            requirementsMarkdown,
            redirectUrl,
            position,
            applicationStatus,
            applicationType,
            linkedFormId,
          ],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      await generateLog(
        actioningUser,
        "SUCCESS",
        "APPLICATION",
        `Created ${displayName}`
      );

      return res.send({
        success: true,
        message: applicationCreatedLang.replace(
          "%DISPLAYNAME%",
          displayName
        ),
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const actioningUser = required(req.body, "actioningUser", res);
    if (res.sent) return;
    const applicationId = required(req.body, "applicationId", res);
    if (res.sent) return;
    const displayName = required(req.body, "displayName", res);
    if (res.sent) return;
    const description = required(req.body, "description", res);
    if (res.sent) return;
    const displayIcon = required(req.body, "displayIcon", res);
    if (res.sent) return;
    const requirementsMarkdown = required(
      req.body,
      "requirementsMarkdown",
      res
    );
    if (res.sent) return;
    const position = required(req.body, "position", res);
    if (res.sent) return;
    const applicationStatus = required(req.body, "applicationStatus", res);
    if (res.sent) return;

    const applicationType = optional(req.body, "applicationType") || "external";
    const redirectUrl = optional(req.body, "redirectUrl");
    const linkedFormId = optional(req.body, "linkedFormId");

    let applicationEditedLang = lang.applications.applicationEdited;

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `
                  UPDATE
                      applications
                  SET
                      displayName=?,
                      displayIcon=?,
                      description=?,
                      requirementsMarkdown=?,
                      redirectUrl=?,
                      position=?,
                      applicationStatus=?,
                      applicationType=?,
                      linkedFormId=?
                  WHERE applicationId=?;`,
          [
            displayName,
            displayIcon,
            description,
            requirementsMarkdown,
            redirectUrl,
            position,
            applicationStatus,
            applicationType,
            linkedFormId,
            applicationId,
          ],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      await generateLog(
        actioningUser,
        "SUCCESS",
        "APPLICATION",
        `Edited ${displayName}`
      );

      return res.send({
        success: true,
        message: applicationEditedLang.replace(
          "%DISPLAYNAME%",
          displayName
        ),
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const actioningUser = required(req.body, "actioningUser", res);
    if (res.sent) return;
    const applicationId = required(req.body, "applicationId", res);
    if (res.sent) return;

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `DELETE FROM applications WHERE applicationId=?;`,
          [applicationId],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      // Remove any eligibility rules attached to this application
      await deleteEligibilityRules(applicationId).catch(() => {});

      await generateLog(
        actioningUser,
        "WARNING",
        "APPLICATION",
        `Deleted ${applicationId}`
      );

      return res.send({
        success: true,
        message: `Deletion of application with the id ${applicationId} has been successful`,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  // ─── Eligibility Rules ───────────────────────────────────────────────────

  app.get(baseEndpoint + "/eligibility/rules", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const applicationId = optional(req.query, "applicationId");
    if (!applicationId) {
      return res.send({ success: false, message: "applicationId is required" });
    }

    try {
      const rules = await getEligibilityRules(applicationId);
      return res.send({ success: true, data: rules });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(baseEndpoint + "/eligibility/rules", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const actioningUser = required(req.body, "actioningUser", res);
    if (res.sent) return;
    const applicationId = required(req.body, "applicationId", res);
    if (res.sent) return;

    const rules = {
      minimum_playtime_hours: optional(req.body, "minimum_playtime_hours"),
      block_if_currently_banned: optional(req.body, "block_if_currently_banned") || false,
      block_if_ever_banned: optional(req.body, "block_if_ever_banned") || false,
      punishment_lookback_months: optional(req.body, "punishment_lookback_months"),
      max_punishments_in_lookback: optional(req.body, "max_punishments_in_lookback"),
      block_if_banned_on_any_platform: optional(req.body, "block_if_banned_on_any_platform") || false,
      require_discord_activity: optional(req.body, "require_discord_activity") || false,
      discord_activity_lookback_days: optional(req.body, "discord_activity_lookback_days"),
      minimum_discord_messages: optional(req.body, "minimum_discord_messages"),
    };

    try {
      await saveEligibilityRules(applicationId, rules);
      await generateLog(actioningUser, "SUCCESS", "APPLICATION", `Updated eligibility rules for application ${applicationId}`);
      return res.send({ success: true, message: "Eligibility rules saved." });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  app.post(baseEndpoint + "/eligibility/rules/delete", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const actioningUser = required(req.body, "actioningUser", res);
    if (res.sent) return;
    const applicationId = required(req.body, "applicationId", res);
    if (res.sent) return;

    try {
      await deleteEligibilityRules(applicationId);
      await generateLog(actioningUser, "WARNING", "APPLICATION", `Deleted eligibility rules for application ${applicationId}`);
      return res.send({ success: true, message: "Eligibility rules deleted." });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ─── Eligibility Check ───────────────────────────────────────────────────

  app.post(baseEndpoint + "/eligibility/check", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const applicationId = required(req.body, "applicationId", res);
    if (res.sent) return;
    const userId = required(req.body, "userId", res);
    if (res.sent) return;

    const overrideRaw = optional(req.body, "override");
    const override = overrideRaw === true || overrideRaw === "true" || overrideRaw === 1;

    try {
      const result = await checkApplicationEligibility(userId, applicationId, { override });
      return res.send({ success: true, data: result });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ─── Eligibility Snapshot ────────────────────────────────────────────────

  app.get(baseEndpoint + "/eligibility/snapshot", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const formResponseId = optional(req.query, "formResponseId");
    if (!formResponseId) {
      return res.send({ success: false, message: "formResponseId is required" });
    }

    try {
      const snapshot = await getEligibilitySnapshotByResponse(formResponseId);
      return res.send({ success: true, data: snapshot });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  // ─── Eligibility Override ────────────────────────────────────────────────

  app.post(baseEndpoint + "/eligibility/override", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const staffUserId = required(req.body, "staffUserId", res);
    if (res.sent) return;
    const applicantUserId = required(req.body, "applicantUserId", res);
    if (res.sent) return;
    const applicationId = required(req.body, "applicationId", res);
    if (res.sent) return;
    const failedRules = optional(req.body, "failedRules") || [];

    try {
      await createEligibilityOverride({
        staffUserId,
        applicantUserId,
        applicationFormId: applicationId,
        failedRules,
      });
      await generateLog(
        staffUserId,
        "WARNING",
        "APPLICATION",
        `Eligibility override used for applicant ${applicantUserId} on application ${applicationId}`
      );
      return res.send({ success: true, message: "Override recorded." });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });

  app.get(baseEndpoint + "/eligibility/overrides", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;

    const applicationId = optional(req.query, "applicationId");
    if (!applicationId) {
      return res.send({ success: false, message: "applicationId is required" });
    }

    try {
      const overrides = await getEligibilityOverrides(applicationId);
      return res.send({ success: true, data: overrides });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: `${error}` });
    }
  });
}
