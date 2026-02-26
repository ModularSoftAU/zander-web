import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";

export default function applicationApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/application";

  app.get(baseEndpoint + "/get", async function (req, res) {
    if (!isFeatureEnabled(features.applications, res, lang)) return;
    const applicationId = optional(req.query, "id");

    try {
      const results = await new Promise((resolve, reject) => {
        let dbQuery;
        let params = [];
        if (applicationId) {
          dbQuery = "SELECT * FROM applications WHERE applicationId=?;";
          params = [applicationId];
        } else {
          dbQuery = "SELECT * FROM applications ORDER BY position ASC;";
        }

        db.query(dbQuery, params, (error, results) => {
          if (error) return reject(error);
          resolve(results);
        });
      });

      if (!results || !results.length) {
        { res.send({
          success: false,
          message: lang.applications.noApplicationsFound,
        }); return; }
      }

      { res.send({
        success: true,
        data: results,
      }); return; }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        { res.status(500).send({
          success: false,
          message: `${error}`,
        }); return; }
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
    const redirectUrl = required(req.body, "redirectUrl", res);
    if (res.sent) return;
    const position = required(req.body, "position", res);
    if (res.sent) return;
    const applicationStatus = required(req.body, "applicationStatus", res);
    if (res.sent) return;

    let applicationCreatedLang = lang.applications.applicationCreated;

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO applications
              (displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position, applicationStatus)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            displayName,
            description,
            displayIcon,
            requirementsMarkdown,
            redirectUrl,
            position,
            applicationStatus,
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

      { res.send({
        success: true,
        message: applicationCreatedLang.replace(
          "%DISPLAYNAME%",
          displayName
        ),
      }); return; }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        { res.status(500).send({
          success: false,
          message: `${error}`,
        }); return; }
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
    const redirectUrl = required(req.body, "redirectUrl", res);
    if (res.sent) return;
    const position = required(req.body, "position", res);
    if (res.sent) return;
    const applicationStatus = required(req.body, "applicationStatus", res);
    if (res.sent) return;

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
                      applicationStatus=?
                  WHERE applicationId=?;`,
          [
            displayName,
            displayIcon,
            description,
            requirementsMarkdown,
            redirectUrl,
            position,
            applicationStatus,
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

      { res.send({
        success: true,
        message: applicationEditedLang.replace(
          "%DISPLAYNAME%",
          displayName
        ),
      }); return; }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        { res.status(500).send({
          success: false,
          message: `${error}`,
        }); return; }
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

      await generateLog(
        actioningUser,
        "WARNING",
        "APPLICATION",
        `Deleted ${applicationId}`
      );

      { res.send({
        success: true,
        message: `Deletion of application with the id ${applicationId} has been successful`,
      }); return; }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        { res.status(500).send({
          success: false,
          message: `${error}`,
        }); return; }
      }
    }
  });
}
