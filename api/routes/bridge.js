import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";

export default function bridgeApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/bridge";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);
    const bridgeId = optional(req.query, "id");
    const actionServer = optional(req.query, "actionServer");

    try {
      function getBridge(dbQuery) {
        db.query(dbQuery, function (error, results, fields) {
          if (error) {
            res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results) {
            return res.send({
              success: false,
              message: `No Bridge actions can be found`,
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
      if (actionServer) {
        let dbQuery = `SELECT * FROM bridge WHERE actionServer='${actionServer}';`;
        getBridge(dbQuery);
      }

      // Return all Bridge actions by default
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

  app.post(baseEndpoint + "/action/add", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    const actionType = required(req.body, "actionType", res);
    const actionData = required(req.body, "actionData", res);
    const actionServer = optional(req.body, "actionServer", res);

    try {
      db.query(
        `INSERT INTO bridge (actionType, actionData, actionServer) VALUES (?, ?, ?)`,
        [actionType, actionData, actionServer],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: `New Bridge action added for ${actionServer}: ${actionType}`,
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

  app.post(baseEndpoint + "/action/process", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    const bridgeId = required(req.body, "bridgeId", res);

    try {
      const fetchURL = `${process.env.siteAddress}/api/bridge/get?id=${bridgeId}`;
      const response = await fetch(fetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const bridgeApiData = await response.json();

      db.query(
        `DELETE FROM bridge WHERE bridgeId=?;`,
        [1, bridgeId],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: `Bridge ID ${bridgeId} has been executed.`,
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

  app.get(baseEndpoint + "/server/get", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    try {
      db.query(`SELECT * FROM serverStatus;`, function (error, results) {
        if (error) {
          return res.send({
            success: false,
            message: `Failed: ${error}`,
          });
        }

        return res.send({
          success: true,
          data: results,
        });
      });
    } catch (error) {
      return res.send({
        success: false,
        message: `Unexpected error: ${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/server/update", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    const serverInfo = required(req.body, "serverInfo", res);
    let lastUpdated = required(req.body, "lastUpdated", res);

    try {
      const serverInfoString = JSON.stringify(serverInfo);

      db.query(
        `UPDATE serverStatus SET statusInfo = ?, lastUpdated = ? WHERE serverStatusId = 1;`,
        [serverInfoString, lastUpdated],
        function (error, updateResults) {
          if (error) {
            return res.send({
              success: false,
              message: `Update failed: ${error}`,
            });
          }

          return res.send({
            success: true,
            message: `Server status updated successfully.`,
          });
        }
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `Unexpected error: ${error}`,
      });
    }
  });
}