import { isFeatureEnabled, required, optional, generateLog } from "../common";

export default function applicationApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/application";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.applications, res, lang);
    const applicationId = optional(req.query, "applicationId");

    try {
      function getApplications(dbQuery) {
        db.query(dbQuery, function (error, results, fields) {
          console.log(results);
          
          if (error) {
            res.send({
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
        let dbQuery = `SELECT * FROM applications WHERE applicationId=${applicationId};`;
        getApplications(dbQuery);
      }

      // Return all Servers by default
      let dbQuery = `SELECT * FROM applications ORDER BY position ASC;`;
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
    const redirectUrl = required(req.body, "redirectUrl", res);
    const position = required(req.body, "position", res);
    const applicationStatus = required(req.body, "applicationStatus", res);

    let applicationCreatedLang = lang.applications.applicationCreated;

    try {
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
    const redirectUrl = required(req.body, "redirectUrl", res);
    const position = required(req.body, "position", res);
    const applicationStatus = required(req.body, "applicationStatus", res);

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
