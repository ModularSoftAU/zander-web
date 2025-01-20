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
    const targetServer = optional(req.query, "targetServer");

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
      if (targetServer) {
        let dbQuery = `SELECT * FROM bridge WHERE targetServer='${targetServer}';`;
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
    const targetServer = required(req.body, "targetServer", res);

    try {
      db.query(
        `INSERT INTO bridge (actionType, targetServer) VALUES (?, ?)`,
        [actionType, targetServer],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: `New Bridge action added for ${targetServer}: ${actionType}`,
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
}