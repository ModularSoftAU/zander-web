export default async function webApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/web";

  app.get(baseEndpoint + "/configuration", async function (req, res) {
    // There is no isFeatureEnabled() due to being a critical endpoint.

    return res.send({
      success: true,
      data: {
        siteName: config.siteConfiguration.siteName,
        siteAddress: process.env.siteAddress,
      },
    });
  });

  app.get(baseEndpoint + "/statistics", async function (req, res) {
    // There is no isFeatureEnabled() due to being a critical endpoint.

    db.query(
      `
      SELECT COUNT(*) AS communityMembers FROM users;
      SELECT HOUR(SEC_TO_TIME(SUM(TIME_TO_SEC(TIMEDIFF(COALESCE(sessionEnd, NOW()), sessionStart))))) AS timePlayed FROM gameSessions;
      SELECT COUNT(DISTINCT(u.uuid)) totalStaff FROM userRanks ur JOIN ranks r ON ur.rankSlug = r.rankSlug JOIN users u ON u.uuid = ur.uuid WHERE r.isStaff = 1 AND u.account_disabled = 0;
  `,
      async function (err, results) {
        if (err) {
          return console.log(err);
        }

        // General
        let communityMembers = results[0][0].communityMembers;
        let timePlayed = results[1][0].timePlayed;
        let staffMembers = results[2][0].totalStaff;

        return res.send({
          success: true,
          data: {
            general: {
              communityMembers: communityMembers,
              timePlayed: timePlayed,
              staffMembers: staffMembers,
            },
          },
        });
      }
    );

    return res;
  });

  app.get(baseEndpoint + "/logs/get", async function (req, res) {
    try {
      db.query(
        `SELECT logId, creatorId, (SELECT username FROM users WHERE userId=creatorId) AS 'actionedUsername', logFeature, logType, description, actionedDateTime FROM logs ORDER BY actionedDateTime DESC;`,
        function (error, results, fields) {
          if (error) {
            res.send({
              success: false,
              message: `${error}`,
            });
          }

          if (!results.length) {
            res.send({
              success: false,
              message: `There are no logs`,
            });
          }

          res.send({
            success: true,
            data: results,
          });
        }
      );
    } catch (error) {
      res.send({
        success: false,
        message: error,
      });
    }

    return res;
  });
}
