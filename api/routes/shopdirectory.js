import { getProfilePicture } from "../../controllers/userController.js";
import { isFeatureEnabled, optional } from "../common.js";
import pLimit from "p-limit";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    isFeatureEnabled(features.shopdirectory, res, lang);

    const material = optional(req.query, "material");
    const limit = pLimit(20);

    // Per-request caches to deduplicate external API calls
    const itemCache = new Map();
    const userCache = new Map();
    const profilePicCache = new Map();

    async function fetchItemData(itemName) {
      if (itemCache.has(itemName)) return itemCache.get(itemName);
      const promise = (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const itemResponse = await fetch(
            `https://craftdex.onrender.com/search/${itemName}`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);
          if (itemResponse.ok) {
            const data = await itemResponse.json();
            return data.data || {};
          }
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("Error fetching item data:", err);
          }
        }
        return {};
      })();
      itemCache.set(itemName, promise);
      return promise;
    }

    async function fetchUserData(userId) {
      if (userCache.has(userId)) return userCache.get(userId);
      const promise = (async () => {
        try {
          const userResponse = await fetch(
            `${process.env.siteAddress}/api/user/get?userId=${userId}`,
            { headers: { "x-access-token": process.env.apiKey } }
          );
          if (userResponse.ok) {
            const data = await userResponse.json();
            return data.data?.[0] || {};
          }
          console.error(`Failed to fetch user data: ${userResponse.status}`);
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
        return {};
      })();
      userCache.set(userId, promise);
      return promise;
    }

    async function fetchProfilePicture(username) {
      if (!username) return "";
      if (profilePicCache.has(username)) return profilePicCache.get(username);
      const promise = (async () => {
        try {
          return await getProfilePicture(username) || "";
        } catch (err) {
          console.error("Error fetching profile picture:", err);
          return "";
        }
      })();
      profilePicCache.set(username, promise);
      return promise;
    }

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
              const modifiedShops = await Promise.all(
                results.map((shop) =>
                  limit(async () => {
                    const itemName = shop.item.trim();

                    const [itemData, userData] = await Promise.all([
                      fetchItemData(itemName),
                      fetchUserData(shop.userId),
                    ]);

                    const profilePicture = await fetchProfilePicture(userData.username);

                    // Use the DB display_name for enchanted books (includes enchantment details)
                    // Fall back to Craftdex displayName, then raw item ID
                    let displayName = itemData.displayName || itemName;
                    if (shop.display_name) {
                      displayName = `Enchanted Book (${shop.display_name})`;
                    }

                    return {
                      ...shop,
                      itemData: {
                        ...itemData,
                        displayName,
                      },
                      userData: {
                        username: userData.username || "",
                        discordId: userData.discordId || "",
                        profilePicture,
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
        ? `SELECT * FROM shoppingDirectory WHERE item LIKE '%${material}%' OR item LIKE '%${material
            .toUpperCase()
            .replace(/ /g, "_")}%';`
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
