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
        `INSERT INTO bridge (command, targetedServer) VALUES (?, ?)`,
        [command, targetedServer],
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

    const bridgeId = required(req.body, "bridgeId", res);

    try {
      const fetchURL = `${process.env.siteAddress}/api/bridge/get?id=${bridgeId}`;
      const response = await fetch(fetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const bridgeApiData = await response.json();

      db.query(
        `UPDATE bridge SET processed=? WHERE bridgeId=?;`,
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
            message: `Bridge ID ${bridgeId} has been executed with command: ${bridgeApiData.data[0]}`,
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
