import { getProfilePicture } from "../../controllers/userController";
import { isFeatureEnabled, optional } from "../common";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.shopdirectory, res, lang);

    const material = optional(req.query, "material");

    try {
      function getShops(dbQuery) {
        return new Promise(async (resolve, reject) => {
          db.query(dbQuery, async function (error, results, fields) {
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
                // Use map to process each shop and wait for all asynchronous operations
                const modifiedShops = await Promise.all(
                  results.map(async (shop) => {
                    const itemName = shop.item.trim();

                    //
                    // Get all Shop item data from Craftdex
                    //
                    const itemFetchURL = `https://craftdex.onrender.com/search/${itemName}`;
                    const itemResponse = await fetch(itemFetchURL);
                    const itemApiData = await itemResponse.json();

                    //
                    // Get shop seller data
                    //
                    const userFetchURL = `${process.env.siteAddress}/api/user/get?userId=${shop.userId}`;
                    const userResponse = await fetch(userFetchURL, {
                      headers: { "x-access-token": process.env.apiKey },
                    });
                    const userApiData = await userResponse.json();

                    // Get profile picture for the user
                    const profilePicture = await getProfilePicture(
                      userApiData.data[0]?.username
                    );

                    // Return the modified shop data with itemData and filtered userData
                    return {
                      ...shop,
                      itemData: itemApiData.data || {}, // Replace 'item' with 'itemData'
                      userData: {
                        username: userApiData.data[0]?.username || "", // Only keep username
                        discordId: userApiData.data[0]?.discordId || "", // Only keep discordId
                        profilePicture: profilePicture || "", // Add the profile picture
                      },
                    };
                  })
                );

                // Send the modified data back in the response
                res.send({
                  success: true,
                  data: modifiedShops,
                });
              }
              resolve();
            }
          });
        });
      }

      // Get Shops by Material
      if (material) {
        let dbQuery = `SELECT * FROM shoppingDirectory WHERE item LIKE '%${material}%';`; // Ensure material is safe from injection
        await getShops(dbQuery);
      } else {
        // Return all shops by default
        let dbQuery = `SELECT * FROM shoppingDirectory;`;
        await getShops(dbQuery);
      }
    } catch (error) {
      console.error(error);
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
