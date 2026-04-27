import { hasPermission } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEATURES_PATH = path.resolve(__dirname, "../../features.json");

export default function dashboardSettingsRoute(app, config, features, lang) {
  app.get("/dashboard/settings", async function (req, res) {
    if (!await hasPermission("zander.web.settings", req, res, features)) return;

    // Read features.json fresh from disk each request so the page always
    // reflects the file's actual content, not the server's require() cache.
    let diskFeatures = features;
    try {
      diskFeatures = JSON.parse(await fs.readFile(FEATURES_PATH, "utf8"));
    } catch (err) {
      console.error("[settings] Failed to read features.json from disk:", err.message);
    }

    const announcementWeb = await getWebAnnouncement();

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/settings", {
        pageTitle: "Settings",
        config,
        features: diskFeatures,
        req,
        announcementWeb,
        ...adminViewData(req, features),
      })
    );
  });
}
