import { expandString, isFeatureEnabled, required } from "../common";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.shopdirectory, res, lang);
    const material = optional(req.query, "material");

    try {
      function getShops(dbQuery) {
        return new Promise((resolve, reject) => {
          db.query(dbQuery, function (error, results, fields) {
            if (error) {
              console.error(error);
              reject(error);
            } else {
              if (!results.length) {
                res.send({
                  success: false,
                  message: `There are no shops available.`,
                });
              } else {
                res.send({
                  success: true,
                  data: results,
                });
              }
              resolve();
            }
          });
        });
      }

      // Get Shops by material
      if (material) {
        let dbQuery = `SELECT * FROM shoppingDirectory WHERE item='${material}';`;
        await getShops(dbQuery);
      }

      // Return all reports by default
      let dbQuery = `SELECT * FROM shoppingDirectory;`;
      await getShops(dbQuery);
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
