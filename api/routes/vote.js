import { isFeatureEnabled, required, optional, generateLog } from "../common";

export default function voteApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/vote";

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);
    const id = optional(req.query, "id");
    const type = optional(req.query, "type");

    try {
      db.query(
        `SELECT * FROM votes;`,
        function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          return res.send({
            success: true,
            data: `New Bridge command added for ${targetServer}: ${command}`,
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.server, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const displayName = required(req.body, "displayName", res);
    const serverType = required(req.body, "serverType", res);
    const serverConnectionAddress = required(req.body, "serverConnectionAddress", res);
    const position = required(req.body, "position", res);

    const serverCreatedLang = lang.server.serverCreated;

    try {
      db.query(
        `
        INSERT INTO 
            servers
        (
            displayName,
            serverType,
            serverConnectionAddress,
            position
        ) VALUES (?, ?, ?, ?)`,
        [displayName, serverType, serverConnectionAddress, position],
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
            "SERVER",
            `Created ${displayName} (${serverConnectionAddress})`,
            res
          );

          return res.send({
            success: true,
            message: serverCreatedLang.replace("%NAME%", displayName),
          });
        }
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    isFeatureEnabled(features.server, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const serverId = required(req.body, "serverId", res);
    const displayName = required(req.body, "displayName", res);
    const serverType = required(req.body, "serverType", res);
    const serverConnectionAddress = required(
      req.body,
      "serverConnectionAddress",
      res
    );
    const position = required(req.body, "position", res);

    try {
      db.query(
        `
            UPDATE 
                servers 
            SET 
                displayName=?,
                serverType=?,
                serverConnectionAddress=?, 
                position=? 
            WHERE 
                serverId=?`,
        [displayName, serverType, serverConnectionAddress, position, serverId],
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
            "SERVER",
            `Edited ${displayName} (${serverConnectionAddress})`,
            res
          );

          return res.send({
            success: true,
            message: lang.server.serverEdited,
          });
        }
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    isFeatureEnabled(features.server, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const serverId = required(req.body, "serverId", res);

    try {
      db.query(
        `DELETE FROM servers WHERE serverId=?;`,
        [serverId],
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
            "SERVER",
            `Deleted ${serverId}`,
            res
          );

          return res.send({
            success: true,
            message: lang.server.serverDeleted,
          });
        }
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
