import { optional } from "../common.js";

export default function punishmentsApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/punishments";

  app.get(baseEndpoint + "/get", async function (req, res) {
    const rawPage = optional(req.query, "page");
    const rawLimit = optional(req.query, "limit");

    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    try {
      const punishments = await new Promise((resolve, reject) => {
        db.query(
          `SELECT p.*, banned.username AS bannedUsername, banner.username AS bannedByUsername, remover.username AS removedByUsername
           FROM punishments p
           LEFT JOIN users banned ON p.bannedUserId = banned.userId
           LEFT JOIN users banner ON p.bannedByUserId = banner.userId
           LEFT JOIN users remover ON p.removedByUserId = remover.userId
           ORDER BY p.dateStart DESC
           LIMIT ? OFFSET ?`,
          [limit, offset],
          (error, results) => {
            if (error) {
              return reject(error);
            }

            resolve(results || []);
          }
        );
      });

      return res.send({
        success: true,
        data: punishments,
        page: page,
        limit: limit,
      });
    } catch (error) {
      console.error("Failed to fetch punishments", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
