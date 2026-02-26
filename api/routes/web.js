export default async function webApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/web";

  app.get(baseEndpoint + "/configuration", async function (req, res) {
    // There is no isFeatureEnabled() due to being a critical endpoint.

    res.send({
      success: true,
      data: {
        siteName: config.siteConfiguration.siteName,
        siteAddress: process.env.siteAddress,
      },
    }); return;
  });

  app.get(baseEndpoint + "/statistics", async function (req, res) {
    // There is no isFeatureEnabled() due to being a critical endpoint.

    try {
      const results = await new Promise((resolve, reject) => {
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
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      });

      // General
      const communityMembers = results[0][0].communityMembers || 0;
      const timePlayed = results[1][0].timePlayed || 0;
      const staffMembers = results[2][0].totalStaff || 0;

      res.send({
        success: true,
        data: {
          general: {
            communityMembers: communityMembers,
            timePlayed: timePlayed,
            staffMembers: staffMembers,
          },
        },
      }); return;
    } catch (err) {
      console.error(err);
      res.status(500).send({
        success: false,
        message: "Internal Server Error",
      }); return;
    }
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

      const results = await new Promise((resolve, reject) => {
        db.query(
          `SELECT l.logId, l.creatorId, u.username AS actionedUsername, l.logFeature, l.logType, l.description, l.actionedDateTime FROM logs l LEFT JOIN users u ON l.creatorId = u.userId ${whereClause} ORDER BY l.actionedDateTime DESC;`,
          params,
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      if (!results || !results.length) {
        res.send({
          success: false,
          message: `There are no logs`,
        }); return;
      }

      res.send({
        success: true,
        data: results,
      }); return;
    } catch (error) {
      console.error(error);
      res.status(500).send({
        success: false,
        message: `${error}`,
      }); return;
    }
  });
}
