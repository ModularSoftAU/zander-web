import { isFeatureEnabled, optional } from "../common";

export default function rankApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/rank";

  const queryDb = (query, params) => {
    return new Promise((resolve, reject) => {
      db.query(query, params, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  };

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);
    const username = optional(req.query, "username");
    const rank = optional(req.query, "rank");

    try {
      if (username) {
        // If the ?username= is used, get all ranks for that user
        const results = await queryDb(
          `
            SELECT
                r.*,
                ur.title
            FROM ranks r
                JOIN userRanks ur ON ur.rankSlug = r.rankSlug
                JOIN luckPermsPlayers lpPlayers ON ur.uuid = lpPlayers.uuid
            WHERE lpPlayers.username = ?
          `,
          [username]
        );
        return res.send({
          success: true,
          data: results,
        });
      }

      if (rank) {
        // If the ?rank= is used, get all users with that rank
        const results = await queryDb(
          `
            SELECT
                u.userId,
                lpPlayers.uuid,
                COALESCE(u.username, lpPlayers.username) AS username,
                r.rankSlug,
                r.displayName,
                r.rankBadgeColour,
                r.rankTextColour,
                ur.title
            FROM ranks r
                JOIN userRanks ur ON ur.rankSlug = r.rankSlug
                JOIN luckPermsPlayers lpPlayers ON ur.uuid = lpPlayers.uuid
                LEFT JOIN users u ON lpPlayers.uuid = u.uuid
            WHERE r.rankSlug = ?
          `,
          [rank]
        );
        return res.send({
          success: true,
          data: results,
        });
      }

      // If no specific query parameter is used, get all ranks
      const results = await queryDb(`SELECT * FROM ranks;`);
      return res.send({
        success: true,
        data: results,
      });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
