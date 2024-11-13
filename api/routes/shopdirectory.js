import { getProfilePicture } from "../../controllers/userController";
import { isFeatureEnabled, optional } from "../common";
import pLimit from "p-limit";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    isFeatureEnabled(features.shopdirectory, res, lang);

    const material = optional(req.query, "material");
    const limit = pLimit(10); // Limit concurrent async operations

    try {
      async function getShops(dbQuery) {
        return new Promise((resolve, reject) => {
          db.query(dbQuery, async (error, results) => {
            if (error) {
              console.error("Database error:", error);
              reject(error);
              return;
            }

            if (!results.length) {
              res.send({
                success: false,
                message: "There are no shops available.",
              });
              resolve();
              return;
            }

            try {
              // Limit concurrency of async operations
              const modifiedShops = await Promise.all(
                results.map((shop) =>
                  limit(async () => {
                    const itemName = shop.item.trim();

                    // Fetch item data from Craftdex
                    const itemFetchURL = `https://craftdex.onrender.com/search/${itemName}`;
                    const itemResponse = await fetch(itemFetchURL);
                    const itemApiData = await itemResponse.json();

                    // Fetch user data from internal API
                    const userFetchURL = `${process.env.siteAddress}/api/user/get?userId=${shop.userId}`;
                    const userResponse = await fetch(userFetchURL, {
                      headers: { "x-access-token": process.env.apiKey },
                    });
                    const userApiData = await userResponse.json();

                    // Get user profile picture
                    const profilePicture = await getProfilePicture(
                      userApiData.data[0]?.username
                    );

                    // Return the enriched shop data
                    return {
                      ...shop,
                      itemData: itemApiData.data || {},
                      userData: {
                        username: userApiData.data[0]?.username || "",
                        discordId: userApiData.data[0]?.discordId || "",
                        profilePicture: profilePicture || "",
                      },
                    };
                  })
                )
              );

              res.send({
                success: true,
                data: modifiedShops,
              });
            } catch (fetchError) {
              console.error("Error fetching shop data:", fetchError);
              res.send({
                success: false,
                message: "Error processing shop data.",
              });
            }

            resolve();
          });
        });
      }

      // Construct the database query
      const dbQuery = material
        ? `SELECT * FROM shoppingDirectory WHERE item LIKE '%${material}%';`
        : `SELECT * FROM shoppingDirectory;`;

      // Execute the query and process the shops
      await getShops(dbQuery);
    } catch (error) {
      console.error("Unhandled error:", error);
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}