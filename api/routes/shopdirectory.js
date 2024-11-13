import { getProfilePicture } from "../../controllers/userController";
import { isFeatureEnabled, optional } from "../common";
import pLimit from "p-limit";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    isFeatureEnabled(features.shopdirectory, res, lang);

    const material = optional(req.query, "material");
    const limit = pLimit(10);

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
                    let itemApiData = {};
                    try {
                      const itemResponse = await fetch(itemFetchURL);
                      if (itemResponse.ok) {
                        itemApiData = await itemResponse.json();
                      } else {
                        console.error(
                          `Failed to fetch item data: ${itemResponse.status}`
                        );
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
                        console.error(
                          `Failed to fetch user data: ${userResponse.status}`
                        );
                      }
                    } catch (userError) {
                      console.error("Error fetching user data:", userError);
                    }

                    // Get user profile picture
                    let profilePicture = "";
                    try {
                      profilePicture = await getProfilePicture(
                        userApiData.data[0]?.username
                      );
                    } catch (profileError) {
                      console.error(
                        "Error fetching profile picture:",
                        profileError
                      );
                    }

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
              console.error("Error processing shop data:", fetchError);
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
