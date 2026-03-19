import verifyToken from "./verifyToken.js";

export default async function votesApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/votes";

  /**
   * GET /api/votes/top
   * Returns top voters for the current calendar month.
   *
   * Authentication: x-access-token header required.
   *
   * Query params:
   *   limit  (optional, default 10, max 25) — number of players to return
   *
   * Response:
   *   { success: true, data: [{ username, uuid, voteCount }] }
   */
  app.get(baseEndpoint + "/top", verifyToken, async function (req, res) {
    if (!features.votes) {
      return res.send({ success: false, message: "Votes feature is disabled." });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);

    try {
      const results = await new Promise((resolve, reject) => {
        db.query(
          `SELECT uuid, username, COUNT(*) AS voteCount
           FROM votes
           WHERE votedAt >= DATE_FORMAT(NOW(), '%Y-%m-01')
           GROUP BY uuid, username
           ORDER BY voteCount DESC
           LIMIT ?`,
          [limit],
          (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          }
        );
      });

      return res.send({
        success: true,
        data: results,
      });
    } catch (err) {
      console.error("[votes/top] error:", err);
      return res.status(500).send({ success: false, message: "Internal Server Error" });
    }
  });

  /**
   * POST /api/votes/add
   * Records a vote for a player. Called by a Minecraft voting plugin or webhook.
   *
   * Authentication: x-access-token header required.
   *
   * Request body (JSON):
   *   { uuid: string, username: string, service?: string }
   *
   * Response:
   *   { success: true, message: "Vote recorded." }
   */
  app.post(baseEndpoint + "/add", verifyToken, async function (req, res) {
    if (!features.votes) {
      return res.send({ success: false, message: "Votes feature is disabled." });
    }

    const uuid = typeof req.body?.uuid === "string" ? req.body.uuid.trim() : null;
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : null;
    const service = typeof req.body?.service === "string" ? req.body.service.trim() : "unknown";

    if (!uuid || !username) {
      return res.status(400).send({ success: false, message: "uuid and username are required." });
    }

    if (!/^[0-9a-f-]{36}$/i.test(uuid)) {
      return res.status(400).send({ success: false, message: "Invalid uuid format." });
    }

    if (!/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
      return res.status(400).send({ success: false, message: "Invalid username." });
    }

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO votes (uuid, username, service) VALUES (?, ?, ?)`,
          [uuid, username, service],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      return res.send({ success: true, message: "Vote recorded." });
    } catch (err) {
      console.error("[votes/add] error:", err);
      return res.status(500).send({ success: false, message: "Internal Server Error" });
    }
  });
}
