import { getGlobalImage, hasPermission, setBannerCookie } from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import {
  addWebstoreItemCommand,
  getWebstoreItems,
} from "../../controllers/webstoreController.js";

export default function dashboardWebstoreRoutes(app, config, features, lang) {
  app.get("/dashboard/webstore", async function (req, res) {
    if (!hasPermission("zander.web.webstore", req, res, features)) return;

    let items = [];
    try {
      items = await getWebstoreItems();
    } catch (error) {
      console.error("Failed to load webstore items", error);
      setBannerCookie("warning", "Unable to load webstore items.", res);
    }

    return res.view("dashboard/webstore/index", {
      pageTitle: "Dashboard - Webstore",
      config,
      features,
      req,
      items,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/dashboard/webstore/items/:priceId/commands", async function (req, res) {
    if (!hasPermission("zander.web.webstore", req, res, features)) return;

    const priceId = req.params.priceId ? req.params.priceId.trim() : "";
    const commandTemplate = req.body.commandTemplate
      ? req.body.commandTemplate.trim()
      : "";
    const sortOrder = Number(req.body.sortOrder) || 0;

    if (!priceId || !commandTemplate) {
      setBannerCookie("warning", "Command template is required.", res);
      return res.redirect("/dashboard/webstore");
    }

    try {
      await addWebstoreItemCommand({
        stripePriceId: priceId,
        commandTemplate,
        sortOrder,
      });
      setBannerCookie("success", "Command template added.", res);
    } catch (error) {
      console.error("Failed to add webstore command", error);
      setBannerCookie("danger", "Unable to add command template.", res);
    }

    return res.redirect("/dashboard/webstore");
  });
}
