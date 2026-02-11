import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";

export default function applicationApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/application";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.applications, res, lang);
    const applicationId = optional(req.query, "id");

    try {
      function getApplications(dbQuery, params) {
        db.query(dbQuery, params || [], function (error, results, fields) {

          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results.length) {
            return res.send({
              success: false,
              message: lang.applications.noApplicationsFound,
            });
          }

          return res.send({
            success: true,
            data: results,
          });
        });
      }

      // Get Application by ID
      if (applicationId) {
        let dbQuery = `SELECT a.*, f.name as linkedFormName, f.slug as linkedFormSlug, f.status as linkedFormStatus FROM applications a LEFT JOIN forms f ON a.linkedFormId = f.formId WHERE a.applicationId=?;`;
        getApplications(dbQuery, [applicationId]);
        return;
      }

      // Return all applications by default
      let dbQuery = `SELECT a.*, f.name as linkedFormName, f.slug as linkedFormSlug, f.status as linkedFormStatus FROM applications a LEFT JOIN forms f ON a.linkedFormId = f.formId ORDER BY a.position ASC;`;
      getApplications(dbQuery);
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.applications, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const displayName = required(req.body, "displayName", res);
    const description = required(req.body, "description", res);
    const displayIcon = required(req.body, "displayIcon", res);
    const requirementsMarkdown = required(
      req.body,
      "requirementsMarkdown",
      res
    );
    const position = required(req.body, "position", res);
    const applicationStatus = required(req.body, "applicationStatus", res);

    const applicationType = optional(req.body, "applicationType") || "external";
    const redirectUrl = optional(req.body, "redirectUrl");
    const linkedFormId = optional(req.body, "linkedFormId");

    let applicationCreatedLang = lang.applications.applicationCreated;

    try {
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
            "APPLICATION",
            `Created ${displayName}`,
            res
          );

          return res.send({
            success: true,
            message: applicationCreatedLang.replace(
              "%DISPLAYNAME%",
              displayName
            ),
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
    isFeatureEnabled(features.applications, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const applicationId = required(req.body, "applicationId", res);
    const displayName = required(req.body, "displayName", res);
    const description = required(req.body, "description", res);
    const displayIcon = required(req.body, "displayIcon", res);
    const requirementsMarkdown = required(
      req.body,
      "requirementsMarkdown",
      res
    );
    const position = required(req.body, "position", res);
    const applicationStatus = required(req.body, "applicationStatus", res);

    const applicationType = optional(req.body, "applicationType") || "external";
    const redirectUrl = optional(req.body, "redirectUrl");
    const linkedFormId = optional(req.body, "linkedFormId");

    let applicationEditedLang = lang.applications.applicationEdited;

    try {
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
            "APPLICATION",
            `Edited ${displayName}`,
            res
          );

          return res.send({
            success: true,
            message: applicationEditedLang.replace(
              "%DISPLAYNAME%",
              displayName
            ),
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
    isFeatureEnabled(features.applications, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const applicationId = required(req.body, "applicationId", res);

    try {
      db.query(
        `DELETE FROM applications WHERE applicationId=?;`,
        [applicationId],
        function (error, results, fields) {
          if (error) {
            res.send({
              success: false,
              message: `${error}`,
            });
          }

          generateLog(
            actioningUser,
            "WARNING",
            "APPLICATION",
            `Deleted ${applicationId}`,
            res
          );

          return res.send({
            success: true,
            message: `Deletion of application with the id ${applicationId} has been successful`,
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
