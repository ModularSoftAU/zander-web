import { getGlobalImage, hasPermission, setBannerCookie } from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import {
  addWebstoreItemCommand,
  createWebstoreItem,
  getWebstoreItems,
  updateWebstoreItemStatus,
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

  app.post("/dashboard/webstore/items", async function (req, res) {
    if (!hasPermission("zander.web.webstore", req, res, features)) return;

    const slug = req.body.slug ? req.body.slug.trim() : "";
    const displayName = req.body.displayName ? req.body.displayName.trim() : "";
    const description = req.body.description ? req.body.description.trim() : "";
    const stripePriceId = req.body.stripePriceId ? req.body.stripePriceId.trim() : "";
    const purchaseType = req.body.purchaseType ? req.body.purchaseType.trim() : "one_time";
    const currency = req.body.currency ? req.body.currency.trim() : "usd";
    const priceCents = Number(req.body.priceCents) || 0;
    const sortOrder = Number(req.body.sortOrder) || 0;
    const isActive = req.body.isActive === "on";

    if (!slug || !displayName || !stripePriceId || !priceCents) {
      setBannerCookie("warning", "Slug, display name, Stripe price, and price are required.", res);
      return res.redirect("/dashboard/webstore");
    }

    try {
      await createWebstoreItem({
        slug,
        displayName,
        description,
        priceCents,
        currency,
        purchaseType,
        stripePriceId,
        isActive,
        sortOrder,
      });

      setBannerCookie("success", "Webstore item created.", res);
    } catch (error) {
      console.error("Failed to create webstore item", error);
      setBannerCookie("danger", "Unable to create webstore item.", res);
    }

    return res.redirect("/dashboard/webstore");
  });

  app.post("/dashboard/webstore/items/:itemId/commands", async function (req, res) {
    if (!hasPermission("zander.web.webstore", req, res, features)) return;

    const itemId = Number(req.params.itemId);
    const commandTemplate = req.body.commandTemplate
      ? req.body.commandTemplate.trim()
      : "";
    const sortOrder = Number(req.body.sortOrder) || 0;

    if (!itemId || Number.isNaN(itemId) || !commandTemplate) {
      setBannerCookie("warning", "Command template is required.", res);
      return res.redirect("/dashboard/webstore");
    }

    try {
      await addWebstoreItemCommand({ itemId, commandTemplate, sortOrder });
      setBannerCookie("success", "Command template added.", res);
    } catch (error) {
      console.error("Failed to add webstore command", error);
      setBannerCookie("danger", "Unable to add command template.", res);
    }

    return res.redirect("/dashboard/webstore");
  });

  app.post("/dashboard/webstore/items/:itemId/status", async function (req, res) {
    if (!hasPermission("zander.web.webstore", req, res, features)) return;

    const itemId = Number(req.params.itemId);
    const isActive = req.body.isActive === "on";

    if (!itemId || Number.isNaN(itemId)) {
      setBannerCookie("warning", "Invalid item selected.", res);
      return res.redirect("/dashboard/webstore");
    }

    try {
      await updateWebstoreItemStatus(itemId, isActive);
      setBannerCookie("success", "Item status updated.", res);
    } catch (error) {
      console.error("Failed to update webstore item", error);
      setBannerCookie("danger", "Unable to update item status.", res);
    }

    return res.redirect("/dashboard/webstore");
  });
}
