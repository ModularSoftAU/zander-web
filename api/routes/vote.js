import { isFeatureEnabled, required, optional, generateLog } from "../common.js";

export default function voteApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/vote";

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);

    try {
      db.query(`SELECT * FROM votes;`, function (error, results, fields) {
        if (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }

        if (!results || results.length === 0) {
          return res.send({
            success: false,
            message: "There are no votes available.",
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
        message: `${error}`,
      });
    }
  });

  app.get(baseEndpoint + "/site/get", async function (req, res) {
    // Check if the feature is enabled
    if (!isFeatureEnabled(features.vote, res, lang)) {
      return; // Exit if the feature is not enabled
    }

    try {
      db.query(`SELECT * FROM voteSite;`, function (error, results, fields) {
        if (error) {
          console.error("Database query error:", error);
          res.send({
            success: false,
            message: `Database query error: ${error.message}`,
          });
          return; // Ensure no further code execution after sending response
        }

        if (!results || results.length === 0) {
          console.log("No vote sites available.");
          res.send({
            success: false,
            message: "There are no vote sites available.",
          });
          return; // Ensure no further code execution after sending response
        }

        console.log("Vote sites retrieved:", results);
        res.send({
          success: true,
          data: results,
        });
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      res.send({
        success: false,
        message: `Unexpected error: ${error.message}`,
      });
    }
  });


  app.post(baseEndpoint + "/site/create", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const voteSiteDisplayName = required(req.body, "voteSiteDisplayName", res);
    const voteSiteRedirect = required(req.body, "voteSiteRedirect", res);

    try {
      db.query(
        `
        INSERT INTO 
            voteSite
        (
            voteSiteDisplayName,
            voteSiteRedirect
        ) VALUES (?, ?)`,
        [voteSiteDisplayName, voteSiteRedirect],
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
            "VOTESITE",
            `Created ${voteSiteDisplayName} (${voteSiteRedirect})`,
            res
          );

          return res.send({
            success: true,
            message: `New vote site added: ${voteSiteDisplayName}`,
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

  app.post(baseEndpoint + "/site/edit", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const voteSiteId = required(req.body, "voteSiteId", res);
    const voteSiteDisplayName = required(req.body, "voteSiteDisplayName", res);
    const voteSiteRedirect = required(req.body, "voteSiteRedirect", res);

    try {
      db.query(
        `
            UPDATE 
                voteSite 
            SET 
                voteSiteDisplayName=?,
                voteSiteRedirect=?
            WHERE 
                voteSiteId=?`,
        [voteSiteDisplayName, voteSiteRedirect, voteSiteId],
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
            "VOTESITE",
            `Edited ${voteSiteDisplayName} (${voteSiteRedirect})`,
            res
          );

          return res.send({
            success: true,
            message: `Vote server edited ${voteSiteDisplayName} (${voteSiteRedirect})`,
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

  app.post(baseEndpoint + "/site/delete", async function (req, res) {
    isFeatureEnabled(features.server, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const voteSiteId = required(req.body, "voteSiteId", res);

    try {
      db.query(
        `DELETE FROM voteSite WHERE voteSiteId=?;`,
        [voteSiteId],
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
            "VOTESITE",
            `Deleted ${voteSiteId}`,
            res
          );

          return res.send({
            success: true,
            message: `Vote site deleted ${voteSiteId}`,
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
