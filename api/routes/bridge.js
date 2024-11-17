import { isFeatureEnabled, required, optional, generateLog } from "../common";

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
      if (targetServer) {
        let dbQuery = `SELECT * FROM bridge WHERE targetServer='${targetServer}' AND processed=0;`;
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
    const targetServer = required(req.body, "targetServer", res);

    try {
      db.query(
        `INSERT INTO bridge (command, targetServer) VALUES (?, ?)`,
        [command, targetServer],
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: `New Bridge command added for ${targetServer}: ${command}`,
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

  app.post(baseEndpoint + "/clear", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    try {
      db.query(
        `TRUNCATE bridge;`,
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            message: `Bridge has now been cleared.`,
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
      db.query(
        `SELECT * FROM serverStatus;`,
        function (error, results) {
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
        }
      );
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

  app.post(baseEndpoint + "/command/process", async function (req, res) {
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
