import { getProfilePicture } from "../../controllers/userController.js";
import { isFeatureEnabled, optional } from "../common.js";
import pLimit from "p-limit";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    isFeatureEnabled(features.shopdirectory, res, lang);

    const material = optional(req.query, "material");
    const includeOutOfStock = optional(req.query, "includeOutOfStock");
    const includeOutOfStockValue =
      String(includeOutOfStock).toLowerCase() === "true";
    const concurrencyLimit = pLimit(10);

    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawOffset = Number.parseInt(req.query.offset, 10);
    const limitValue = Math.min(Math.max(rawLimit || 50, 1), 200);
    const offsetValue = Math.max(rawOffset || 0, 0);

    try {
      const dbQueryParams = [];
      const whereParts = [];

      if (material) {
        whereParts.push("(item LIKE ? OR item LIKE ?)");
        dbQueryParams.push(`%${material}%`);
        dbQueryParams.push(`%${material.toUpperCase().replace(/ /g, "_")}%`);
      }

      if (!includeOutOfStockValue) {
        whereParts.push("stock > 0");
      }

      const whereClause = whereParts.length
        ? `WHERE ${whereParts.join(" AND ")}`
        : "";

      const dataQuery = `SELECT * FROM shoppingDirectory ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`;

      const countQuery = `SELECT COUNT(*) as total FROM shoppingDirectory ${whereClause}`;

      const runQuery = (query, params = []) =>
        new Promise((resolve, reject) => {
          db.query(query, params, (error, results) => {
            if (error) {
              console.error("Database error:", error);
              reject(error);
              return;
            }

            resolve(results);
          });
        });

      const totalResults = await runQuery(countQuery, dbQueryParams);
      const total = totalResults?.[0]?.total || 0;

      const shopResults = await runQuery(dataQuery, [
        ...dbQueryParams,
        limitValue,
        offsetValue,
      ]);

      if (!shopResults.length) {
        res.send({
          success: false,
          message: "There are no shops available.",
          meta: {
            total,
            limit: limitValue,
            offset: offsetValue,
            hasMore: false,
          },
        });
        return;
      }

      try {
        const modifiedShops = await Promise.all(
          shopResults.map((shop) =>
            concurrencyLimit(async () => {
              const itemName = shop.item.trim();

              // Fetch item data from Craftdex
              const itemFetchURL = `https://craftdex.onrender.com/search/${itemName}`;
              let itemApiData = {};
              try {
                const itemResponse = await fetch(itemFetchURL);
                if (itemResponse.ok) {
                  itemApiData = await itemResponse.json();
                } else {
                  console.error(`Failed to fetch item data: ${itemResponse.status}`);
                }
              } catch (itemError) {
                console.error("Error fetching item data:", itemError);
              }

              // Fetch user data from internal API
              const userFetchURL = `${process.env.siteAddress}/api/user/get?userId=${shop.userId}`;
              let userApiData = {};
              try {
                const userResponse = await fetch(userFetchURL, {
                  headers: { "x-access-token": process.env.apiKey },
                });
                if (userResponse.ok) {
                  userApiData = await userResponse.json();
                } else {
                  console.error(`Failed to fetch user data: ${userResponse.status}`);
                }
              } catch (userError) {
                console.error("Error fetching user data:", userError);
              }

              // Get user profile picture
              let profilePicture = "";
              try {
                profilePicture = await getProfilePicture(
                  userApiData.data?.[0]?.username
                );
              } catch (profileError) {
                console.error("Error fetching profile picture:", profileError);
              }

              // Return the enriched shop data
              return {
                ...shop,
                itemData: itemApiData.data || {},
                userData: {
                  username: userApiData.data?.[0]?.username || "",
                  discordId: userApiData.data?.[0]?.discordId || "",
                  profilePicture: profilePicture || "",
                },
              };
            })
          )
        );

        res.send({
          success: true,
          data: modifiedShops,
          meta: {
            total,
            limit: limitValue,
            offset: offsetValue,
            hasMore: offsetValue + modifiedShops.length < total,
          },
        });
      } catch (fetchError) {
        console.error("Error processing shop data:", fetchError);
        res.send({
          success: false,
          message: "Error processing shop data.",
        });
      }
    } catch (error) {
      console.error("Unhandled error:", error);
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
