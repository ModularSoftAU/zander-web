import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";

export default function voteApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/vote";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);
    const username = req.query.username;
    const stats = req.query.stats === "true";

    try {
      function getVotes(dbQuery, queryParams) {
        db.query(dbQuery, queryParams, function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results.length) {
            return res.send({
              success: false,
              message: `No votes can be found`,
            });
          }

          res.send({
            success: true,
            data: results,
          });
        });
      }

      // Get Votes by username
      if (username) {
        let dbQuery = `SELECT * FROM votes WHERE username = ?;`;
        getVotes(dbQuery, [username]);
      }
      // Get stats (total votes per player)
      else if (stats) {
        let dbQuery = `SELECT u.username, COUNT(v.voteId) AS total_votes
          FROM votes v
          JOIN users u ON v.userId = u.userId
          GROUP BY u.username
          ORDER BY total_votes DESC;
        `;
        getVotes(dbQuery, []);
      }
      // Show all votes
      else {
        let dbQuery = `SELECT * FROM votes;`;
        getVotes(dbQuery, []);
      }
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.get(baseEndpoint + "/site/get", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);

    try {
      db.query(`SELECT * FROM voteSite;`, function (error, results, fields) {
        if (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }

        if (!results.length) {
          return res.send({
            success: false,
            message: `There are no vote sites.`,
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

    return res;
  });

  app.post(baseEndpoint + "/cast", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);

    const username = required(req.body, "username", res);
    const voteSiteRedirect = required(req.body, "voteSite", res);

    try {
      db.query(
        `SELECT userId FROM users WHERE username = ?`,
        [username],
        function (error, userResults, fields) {
          if (error || userResults.length === 0) {
            return res.send({
              success: false,
              message: error ? `${error}` : `User not found`,
            });
          }

          const userId = userResults[0].userId;

          // Get voteSiteId from voteSite table
          db.query(
            `SELECT voteSiteId FROM voteSite WHERE voteSiteRedirect LIKE ?`,
            [`%${voteSiteRedirect}%`],
            function (error, siteResults, fields) {
              if (error || siteResults.length === 0) {
                return res.send({
                  success: false,
                  message: error ? `${error}` : `Vote site not found/supported.`,
                });
              }

              const voteSiteId = siteResults[0].voteSiteId;

              // Insert vote into votes table
              db.query(
                `INSERT INTO votes (userId, voteSite) VALUES (?, ?)`,
                [userId, voteSiteId],
                function (error, results, fields) {
                  if (error) {
                    return res.send({
                      success: false,
                      message: `${error}`,
                    });
                  }

                  res.send({
                    success: true,
                    alertType: "success",
                    content: `New vote entry: ${username} on ${voteSiteRedirect}`,
                  });
                }
              );
            }
          );
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
            "VOTE",
            `Created vote site ${voteSiteDisplayName}`,
            res
          );

          res.send({
            success: true,
            alertType: "success",
            content: `Vote site created`,
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
            "VOTE",
            `Edited vote site ${voteSiteDisplayName}`,
            res
          );

          return res.send({
            success: true,
            message: `Edited vote site ${voteSiteDisplayName}`,
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

  app.post(baseEndpoint + "/site/delete", async function (req, res) {
    isFeatureEnabled(features.vote, res, lang);

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
            "WARNING",
            "VOTE",
            `Deleted ${voteSiteId}`,
            res
          );

          return res.send({
            success: true,
            message: `Deleted ${voteSiteId}`,
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
