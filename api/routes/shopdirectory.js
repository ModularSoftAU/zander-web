import { getProfilePicture } from "../../controllers/userController.js";
import { isFeatureEnabled, optional } from "../common.js";
import pLimit from "p-limit";

// Convert a raw minecraft item ID to a human-readable display name
// e.g. "netherite_upgrade_smithing_template" → "Netherite Upgrade Smithing Template"
function formatItemName(rawName) {
  if (!rawName) return "Unknown Item";
  return rawName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
      async function getShops(dbQuery, dbParams) {
        return new Promise((resolve, reject) => {
          db.query(dbQuery, dbParams, async (error, results) => {
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

                    // Build the display name with priority:
                    // 1. DB display_name for enchanted books (shows enchantment details)
                    // 2. Craftdex displayName (official human-readable name)
                    // 3. Formatted raw item ID as fallback (underscores → spaces, title case)
                    let displayName = itemData.displayName || formatItemName(itemName);
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
      // When filtering by material, match against:
      // - The raw item ID (with underscores)
      // - The raw item ID with spaces converted to underscores (user types "grass block" → matches "grass_block")
      // - The display_name column (for enchanted book enchantment names)
      // - Individual words (user types "grass" → matches "grass_block")
      let dbQuery;
      let dbParams = [];
      if (material) {
        const underscored = material.toUpperCase().replace(/ /g, "_");
        const likeTerm = `%${material}%`;
        const likeTermUnderscored = `%${underscored}%`;

        dbQuery = `SELECT * FROM shoppingDirectory
          WHERE item LIKE ?
            OR item LIKE ?
            OR display_name LIKE ?;`;
        dbParams = [likeTerm, likeTermUnderscored, likeTerm];
      } else {
        dbQuery = `SELECT * FROM shoppingDirectory;`;
      }

      // Execute the query and process the shops
      await getShops(dbQuery, dbParams);
    } catch (error) {
      console.error("Unhandled error:", error);
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
