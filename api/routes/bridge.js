import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";
import routinesData from "../../bridgeRoutines.json" assert { type: "json" };
import fetch from "node-fetch";

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
      // Get Bridge by targetServer
      else if (targetServer) {
        let dbQuery = `SELECT * FROM bridge WHERE targetServer='${targetServer}';`;
        getBridge(dbQuery);
      }
      // Return all Bridge actions by default
      else {
        let dbQuery = `SELECT * FROM bridge;`;
        getBridge(dbQuery);
      }
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/action/add", async function (req, res) {
    try {
      isFeatureEnabled(features.bridge, res, lang);
      const actionData = required(req.body, "actionData", res);
      const targetServer = optional(req.body, "targetServer");

      db.query(
        `INSERT INTO bridge (actionData, targetServer) VALUES (?, ?)`,
        [actionData, targetServer],
        function (error, results, fields) {
          if (error) {
            console.error("Database insert error:", error);
            return res.send({
              success: false,
              message: `Database error: ${error}`,
            });
          }

          return res.send({
            success: true,
            message: `New Bridge action added: ${actionData}`,
          });
        }
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      res.send({
        success: false,
        message: `Unexpected error: ${error}`,
      });
    }
  });

  app.post(baseEndpoint + "/routine/execute", async function (req, res) {
    try {
      const routineName = required(req.body, "routine", res);
      const username = required(req.body, "username", res);

      // Check if routinesData is defined and is an object
      if (!routinesData || typeof routinesData !== "object") {
        throw new Error("Routines data is not defined or is not an object");
      }

      // Access the routines array from the imported data
      const routines = routinesData.routines;

      // Check if routines is an array
      if (!Array.isArray(routines)) {
        throw new Error("Routines is not an array");
      }

      // Find the routine that matches the provided name
      const routine = routines.find((r) => r.routine === routineName);
      if (!routine) {
        return res.send({
          success: false,
          message: `Routine ${routineName} does not exist.`,
        });
      }

      console.log("Routine found:", routine);

      // Replace %PLAYER% with the actual player's username in the commands
      const commands = routine.commands.map((cmd) => ({
        command: cmd.command.replace(/%PLAYER%/g, username),
        targetServer: cmd.targetServer,
      }));

      console.log("Commands to execute:", commands);

      // Execute the /action/add POST request for each command
      for (const { command, targetServer } of commands) {
        try {
          const apiPostBody = { actionData: command, targetServer };

          const response = await fetch(
            `${process.env.siteAddress}/api/bridge/action/add`,
            {
              method: "POST",
              body: JSON.stringify(apiPostBody),
              headers: {
                "Content-Type": "application/json",
                "x-access-token": process.env.apiKey,
              },
            }
          );

          const data = await response.json();

          if (data.success) {
            console.log(`Command sent to bridge successfully: ${command}`);
          } else {
            console.error(`Failed to execute command: ${command}`);
          }
        } catch (error) {
          console.error(`Error executing command: ${command}`, error);
        }
      }

      return res.send({
        success: true,
        message: `Routine ${routineName} executed successfully for player ${username}.`,
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.send({
        success: false,
        message: `An unexpected error occurred: ${error.message}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/action/process", async function (req, res) {
    try {
      isFeatureEnabled(features.bridge, res, lang);
      const bridgeId = required(req.body, "id", res);

      db.query(
        `DELETE FROM bridge WHERE bridgeId=?;`,
        [bridgeId],
        function (error, results, fields) {
          if (error) {
            console.error("Database delete error:", error);
            return res.send({
              success: false,
              message: `Database error: ${error}`,
            });
          }

          return res.send({
            success: true,
            message: `Bridge ID ${bridgeId} has been executed.`,
          });
        }
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.send({
        success: false,
        message: `Unexpected error: ${error}`,
      });
    }
  });

  app.get(baseEndpoint + "/server/get", async function (req, res) {
    try {
      isFeatureEnabled(features.bridge, res, lang);

      db.query(`SELECT * FROM serverStatus;`, function (error, results) {
        if (error) {
          console.error("Database query error:", error);
          return res.send({
            success: false,
            message: `Database error: ${error}`,
          });
        }

        return res.send({
          success: true,
          data: results,
        });
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.send({
        success: false,
        message: `Unexpected error: ${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/server/update", async function (req, res) {
    try {
      isFeatureEnabled(features.bridge, res, lang);
      const serverInfo = required(req.body, "serverInfo", res);
      let lastUpdated = required(req.body, "lastUpdated", res);

      const serverInfoString = JSON.stringify(serverInfo);

      db.query(
        `UPDATE serverStatus SET statusInfo = ?, lastUpdated = ? WHERE serverStatusId = 1;`,
        [serverInfoString, lastUpdated],
        function (error, updateResults) {
          if (error) {
            console.error("Database update error:", error);
            return res.send({
              success: false,
              message: `Database error: ${error}`,
            });
          }

          return res.send({
            success: true,
            message: `Server status updated successfully.`,
          });
        }
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.send({
        success: false,
        message: `Unexpected error: ${error}`,
      });
    }
    return res;
  });
}
