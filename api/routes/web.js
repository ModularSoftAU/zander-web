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
    try {
      const [communityMembersResult, timePlayedResult, staffResult] =
        await Promise.all([
          db.query(`
            SELECT COUNT(DISTINCT gs.userId) AS communityMembers
            FROM gameSessions gs
            JOIN users u ON gs.userId = u.userId
            WHERE gs.sessionStart >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
              AND u.account_disabled = 0
          `),
          db.query(`
            SELECT ROUND(SUM(TIMESTAMPDIFF(SECOND, gs.sessionStart, COALESCE(gs.sessionEnd, NOW()))) / 3600) AS timePlayed
            FROM gameSessions gs
            JOIN users u ON gs.userId = u.userId
            WHERE gs.sessionStart >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
              AND u.account_disabled = 0
          `),
          db.query(`
            SELECT COUNT(*) AS totalStaff
            FROM (
              SELECT u.uuid
              FROM userRanks ur
              JOIN ranks r ON ur.rankSlug = r.rankSlug
              JOIN users u ON u.uuid = ur.uuid
              WHERE r.isStaff = 1
                AND u.account_disabled = 0
              GROUP BY u.uuid
            ) staffRoster
          `),
        ]);

      // General
      const communityMembers = communityMembersResult?.[0]?.communityMembers || 0;
      const timePlayed = timePlayedResult?.[0]?.timePlayed || 0;
      const staffMembers = staffResult?.[0]?.totalStaff || 0;

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
    } catch (err) {
      console.error(err);
      return res.send({ success: false, message: "Failed to load statistics" });
    }
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
