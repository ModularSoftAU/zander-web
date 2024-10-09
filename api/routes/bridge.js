import { isFeatureEnabled, required, optional, generateLog } from "../common";

export default function bridgeApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/bridge";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);
    const bridgeId = optional(req.query, "id");
    const targetedServer = optional(req.query, "targetedServer");

    try {
      function getBridge(dbQuery) {
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
              message: `No Bridge requests can be found`,
            });
          }

          return res.send({
            success: true,
            data: results,
          });
        });
      }

      // Get Bridge by ID
      if (bridgeId) {
        let dbQuery = `SELECT * FROM bridge WHERE bridgeId=${bridgeId};`;
        getBridge(dbQuery);
      }

      // Get Bridge by Targeted Server
      if (bridgeId) {
        let dbQuery = `SELECT * FROM bridge WHERE targetedServer=${targetedServer};`;
        getBridge(dbQuery);
      }

      // Return all Bridge requests by default
      let dbQuery = `SELECT * FROM bridge;`;
      getBridge(dbQuery);
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/command/add", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    const command = required(req.body, "command", res);
    const targetedServer = required(req.body, "targetedServer", res);

    try {
      db.query(
        `INSERT INTO bridge 
            (command, targetedServer) 
        VALUES (?, ?)`,
        [
          command,
          targetedServer
        ],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

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

  app.post(baseEndpoint + "/command/process", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

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
}
