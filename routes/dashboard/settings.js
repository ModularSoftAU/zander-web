import { hasPermission } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

export default function dashboardSettingsRoute(app, config, features, lang) {
  app.get("/dashboard/settings", async function (req, res) {
    if (!await hasPermission("zander.web.settings", req, res, features)) return;

    const announcementWeb = await getWebAnnouncement();

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/settings", {
        pageTitle: "Settings",
        config,
        features,
        req,
        announcementWeb,
        ...adminViewData(req, features),
      })
    );
  });
}
