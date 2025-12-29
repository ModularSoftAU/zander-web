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
      SELECT COUNT(DISTINCT gs.userId) AS communityMembers
      FROM gameSessions gs
      JOIN users u ON gs.userId = u.userId
      WHERE gs.sessionStart >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND u.account_disabled = 0;

      SELECT ROUND(SUM(TIMESTAMPDIFF(SECOND, gs.sessionStart, COALESCE(gs.sessionEnd, NOW()))) / 3600) AS timePlayed
      FROM gameSessions gs
      JOIN users u ON gs.userId = u.userId
      WHERE gs.sessionStart >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND u.account_disabled = 0;

      SELECT COUNT(*) AS totalStaff
      FROM (
        SELECT u.uuid
        FROM userRanks ur
        JOIN ranks r ON ur.rankSlug = r.rankSlug
        JOIN users u ON u.uuid = ur.uuid
        WHERE r.isStaff = 1
          AND u.account_disabled = 0
        GROUP BY u.uuid
      ) staffRoster;
  `,
      async function (err, results) {
        if (err) {
          console.error(err);
          return;
        }

        // General
        const communityMembers = results[0][0].communityMembers || 0;
        const timePlayed = results[1][0].timePlayed || 0;
        const staffMembers = results[2][0].totalStaff || 0;

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
      const filters = [];
      const params = [];
      const userFilter = req.query?.user ? String(req.query.user).trim() : "";
      const featureFilter = req.query?.feature
        ? String(req.query.feature).trim()
        : "";

      if (userFilter) {
        filters.push("(u.username = ? OR l.creatorId = ?)");
        params.push(userFilter);
        params.push(Number.isNaN(Number(userFilter)) ? -1 : Number(userFilter));
      }

      if (featureFilter) {
        filters.push("l.logFeature = ?");
        params.push(featureFilter);
      }

      const whereClause = filters.length
        ? `WHERE ${filters.join(" AND ")}`
        : "";

      db.query(
        `SELECT l.logId, l.creatorId, u.username AS actionedUsername, l.logFeature, l.logType, l.description, l.actionedDateTime FROM logs l LEFT JOIN users u ON l.creatorId = u.userId ${whereClause} ORDER BY l.actionedDateTime DESC;`,
        params,
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
