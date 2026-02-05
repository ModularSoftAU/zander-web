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

// Clean and format the DB display_name (strip leftover quotes, title-case each word)
// e.g. "'mending 1'" → "Mending 1", "slow_falling" → "Slow Falling"
function cleanDisplayName(raw) {
  if (!raw) return null;
  return raw
    .replace(/['"]/g, "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Parse a JSON-like enchantment string from the DB into a readable list
// e.g. '{"minecraft:fire_aspect":1,"minecraft:sharpness":2}' → "Fire Aspect 1, Sharpness 2"
function parseEnchantmentJson(raw) {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/['"]/g, '"').trim();
    const obj = JSON.parse(cleaned);
    return Object.entries(obj)
      .map(([key, level]) => {
        const name = key.replace("minecraft:", "").replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return `${name} ${level}`;
      })
      .join(", ");
  } catch {
    return cleanDisplayName(raw);
  }
}

// Map of item IDs that use display_name for a parenthetical label
const ITEM_DISPLAY_LABEL = {
  enchanted_book: "Enchanted Book",
  potion: "Potion",
  splash_potion: "Splash Potion",
  lingering_potion: "Lingering Potion",
  tipped_arrow: "Tipped Arrow",
};

// Shulker box variants (all 17 types)
const SHULKER_BOX_ITEMS = new Set([
  "shulker_box",
  "white_shulker_box",
  "orange_shulker_box",
  "magenta_shulker_box",
  "light_blue_shulker_box",
  "yellow_shulker_box",
  "lime_shulker_box",
  "pink_shulker_box",
  "gray_shulker_box",
  "light_gray_shulker_box",
  "cyan_shulker_box",
  "purple_shulker_box",
  "blue_shulker_box",
  "brown_shulker_box",
  "green_shulker_box",
  "red_shulker_box",
  "black_shulker_box",
]);

const MAX_RESULTS = 50;

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    isFeatureEnabled(features.shopdirectory, res, lang);

    const material = optional(req.query, "material");
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const concurrencyLimit = pLimit(20);

    // Require a search term for web requests (Discord bot always provides one)
    if (!material || material.trim().length < 2) {
      return res.send({
        success: false,
        message: "Please enter a search term (at least 2 characters).",
      });
    }

    // Per-request caches to deduplicate external API calls and DB queries
    const itemCache = new Map();
    const userCache = new Map();
    const profilePicCache = new Map();
    const shulkerCache = new Map();

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
      const promise = new Promise((resolve) => {
        db.query(
          `SELECT userId, username, discordId FROM users WHERE userId = ?`,
          [userId],
          (error, results) => {
            if (error) {
              console.error("Error fetching user data:", error);
              return resolve({});
            }
            resolve(results?.[0] || {});
          }
        );
      });
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

    // Parse shulker box contents from raw QuickShop item YAML
    function parseShulkerContents(rawItemYaml) {
      if (!rawItemYaml) return null;

      // Look for minecraft:container section in the YAML
      const containerMatch = rawItemYaml.match(/minecraft:container:\s*\n([\s\S]*?)(?=\nminecraft:|$)/);
      if (!containerMatch) return null;

      const containerSection = containerMatch[1];

      // Extract all item IDs from the container
      // Format: item:\n      id: minecraft:sand
      const itemMatches = containerSection.matchAll(/id:\s*(?:minecraft:)?([a-z_]+)/gi);
      const items = {};

      for (const match of itemMatches) {
        const itemId = match[1].toLowerCase();
        items[itemId] = (items[itemId] || 0) + 1;
      }

      if (Object.keys(items).length === 0) return null;

      // Format as "Sand x3, Wool x2" (count = number of stacks, not total items)
      const formatted = Object.entries(items)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 3) // Show top 3 items
        .map(([id, count]) => {
          const name = formatItemName(id);
          return count > 1 ? `${name} x${count}` : name;
        })
        .join(", ");

      const totalTypes = Object.keys(items).length;
      if (totalTypes > 3) {
        return `${formatted} +${totalTypes - 3} more`;
      }
      return formatted;
    }

    // Fetch raw item data for shulker boxes to get container contents
    async function fetchShulkerContents(shopId) {
      if (shulkerCache.has(shopId)) return shulkerCache.get(shopId);
      const promise = new Promise((resolve) => {
        db.query(
          `SELECT d.item FROM cfc_prod_quickshop.qs_shops s
           JOIN cfc_prod_quickshop.qs_data d ON s.data = d.id
           WHERE s.id = ?`,
          [shopId],
          (error, results) => {
            if (error || !results?.[0]?.item) {
              return resolve(null);
            }
            resolve(parseShulkerContents(results[0].item));
          }
        );
      });
      shulkerCache.set(shopId, promise);
      return promise;
    }

    try {
      const underscored = material.toUpperCase().replace(/ /g, "_");
      const likeTerm = `%${material}%`;
      const likeTermUnderscored = `%${underscored}%`;

      // First get total count for pagination
      const totalCount = await new Promise((resolve, reject) => {
        db.query(
          `SELECT COUNT(*) AS total FROM shoppingDirectory
            WHERE item LIKE ?
              OR item LIKE ?
              OR display_name LIKE ?`,
          [likeTerm, likeTermUnderscored, likeTerm],
          (error, results) => {
            if (error) return reject(error);
            resolve(results[0]?.total || 0);
          }
        );
      });

      if (totalCount === 0) {
        return res.send({
          success: false,
          message: "No shops found matching your search.",
        });
      }

      const totalPages = Math.ceil(totalCount / MAX_RESULTS);
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * MAX_RESULTS;

      // Fetch the page of results with LIMIT/OFFSET
      const results = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM shoppingDirectory
            WHERE item LIKE ?
              OR item LIKE ?
              OR display_name LIKE ?
            LIMIT ? OFFSET ?`,
          [likeTerm, likeTermUnderscored, likeTerm, MAX_RESULTS, offset],
          (error, results) => {
            if (error) return reject(error);
            resolve(results || []);
          }
        );
      });

      // Enrich results with item data, user data, and profile pictures
      const modifiedShops = await Promise.all(
        results.map((shop) =>
          concurrencyLimit(async () => {
            const itemName = shop.item.trim();

            const [itemData, userData] = await Promise.all([
              fetchItemData(itemName),
              fetchUserData(shop.userId),
            ]);

            const profilePicture = await fetchProfilePicture(userData.username);

            let displayName = itemData.displayName || formatItemName(itemName);
            const parentLabel = ITEM_DISPLAY_LABEL[itemName];

            if (shop.display_name && parentLabel) {
              const cleanedDetail = cleanDisplayName(shop.display_name);
              if (cleanedDetail) {
                displayName = `${parentLabel} (${cleanedDetail})`;
              }
            } else if (shop.display_name && shop.display_name.includes("{")) {
              const enchantList = parseEnchantmentJson(shop.display_name);
              if (enchantList) {
                displayName = `${displayName} (${enchantList})`;
              }
            } else if (SHULKER_BOX_ITEMS.has(itemName)) {
              // Fetch and display shulker box contents
              const contents = await fetchShulkerContents(shop.id);
              if (contents) {
                displayName = `${displayName} (${contents})`;
              }
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
        pagination: {
          page: safePage,
          totalPages,
          totalResults: totalCount,
          perPage: MAX_RESULTS,
        },
      });
    } catch (error) {
      console.error("Unhandled error:", error);
      res.send({
        success: false,
        message: `${error}`,
      });
    }
  });
}
