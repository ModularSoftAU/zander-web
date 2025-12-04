import { getProfilePicture } from "../../controllers/userController.js";
import { isFeatureEnabled, optional } from "../common.js";
import pLimit from "p-limit";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    if (!features.shopdirectory) {
      return res.send({
        success: false,
        message: `${lang.api.featureDisabled}`,
      });
    }

    const material = optional(req.query, "material");
    const limit = pLimit(10);

    try {
      const searchParams = [];
      let dbQuery = "SELECT * FROM shoppingDirectory";

      if (material) {
        dbQuery += " WHERE item LIKE ? OR item LIKE ?";
        searchParams.push(
          `%${material}%`,
          `%${material.toUpperCase().replace(/ /g, "_")}%`
        );
      }

      const results = await db.query(dbQuery, searchParams);

      if (!results.length) {
        return res.send({
          success: false,
          message: "There are no shops available.",
        });
      }

      const modifiedShops = await Promise.all(
        results.map((shop) =>
          limit(async () => {
            const itemName = shop.item.trim();

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

            let profilePicture = "";
            try {
              profilePicture = await getProfilePicture(
                userApiData.data?.[0]?.username
              );
            } catch (profileError) {
              console.error("Error fetching profile picture:", profileError);
            }

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
      });
    } catch (error) {
      console.error("Unhandled error:", error);
      res.status(500).send({
        success: false,
        message: "Error processing shop data.",
      });
    }
  });
}
