import { isFeatureEnabled, optional } from "../common.js";
import { searchShops } from "../../services/shopService.js";

export default function shopApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/shop";

  app.get(baseEndpoint + "/get", async (req, res) => {
    if (!isFeatureEnabled(features.shopdirectory, res, lang)) return;

    const material = optional(req.query, "material");
    const page = parseInt(req.query.page) || 1;

    try {
      const result = await searchShops(material, page, { includeProfilePictures: true });
      { res.send(result); return; }
    } catch (err) {
      console.error("Shop API error:", err);
      if (!res.sent) {
        { res.status(500).send({ success: false, message: "An error occurred while searching shops." }); return; }
      }
    }
  });
}
