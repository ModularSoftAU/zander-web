import { isFeatureEnabled, optional } from "../common.js";
import { searchShops } from "../../services/shopService.js";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    if (!features.shopdirectory) {
      return isFeatureEnabled(features.shopdirectory, res, lang);
    }

    const material = optional(req.query, "material");
    const page = parseInt(req.query.page) || 1;

    try {
      const result = await searchShops(material, page, { includeProfilePictures: true });
      res.send(result);
    } catch (err) {
      console.error("Shop API error:", err);
      res.send({ success: false, message: "An error occurred while searching shops." });
    }
  });
}
