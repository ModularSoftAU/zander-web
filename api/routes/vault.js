import { isFeatureEnabled, required, optional, generateLog } from "../common";

export default function vaultApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/vault";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.vault, res, lang);
    const vaultId = optional(req.query, "id");

    try {
      function getVault(dbQuery) {
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
              message: `No vault items found.`,
            });
          }

          return res.send({
            success: true,
            data: results,
          });
        });
      }

      // Get Vault by ID
      if (vaultId) {
        let dbQuery = `SELECT * FROM vault WHERE vaultId=${vaultId};`;
        getVault(dbQuery);
      }

      // Return all Vault by default
      let dbQuery = `SELECT * FROM vault ORDER BY position ASC;`;
      getVault(dbQuery);
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.vault, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const displayName = required(req.body, "displayName", res);
    const description = required(req.body, "description", res);
    const redirectUrl = required(req.body, "redirectUrl", res);
    const position = required(req.body, "position", res);

    try {
      db.query(
        `INSERT INTO vault 
            (displayName, description, redirectUrl, position) 
        VALUES (?, ?, ?, ?)`,
        [
          displayName,
          description,
          redirectUrl,
          position
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
            "VAULT",
            `Created ${displayName}`,
            res
          );

          return res.send({
            success: true,
            message: `Created ${displayName} vault.`,
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
    isFeatureEnabled(features.vault, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const vaultId = required(req.body, "vaultId", res);
    const displayName = required(req.body, "displayName", res);
    const description = required(req.body, "description", res);
    const redirectUrl = required(req.body, "redirectUrl", res);
    const position = required(req.body, "position", res);

    try {
      db.query(
        `
                UPDATE
                    vault 
                SET 
                    displayName=?, 
                    description=?, 
                    redirectUrl=?, 
                    position=?
                WHERE vaultId=?;`,
        [
          displayName,
          description,
          redirectUrl,
          position,
          vaultId,
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
            "VAULT",
            `Edited ${displayName}`,
            res
          );

          return res.send({
            success: true,
            message: `${displayName} has been edited.`,
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
    isFeatureEnabled(features.vault, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const vaultId = required(req.body, "vaultId", res);

    try {
      db.query(
        `DELETE FROM vault WHERE vaultId=?;`,
        [vaultId],
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
            "VAULT",
            `Deleted ${vaultId}`,
            res
          );

          return res.send({
            success: true,
            message: `Deletion of vault with the id ${vaultId} has been successful.`,
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
