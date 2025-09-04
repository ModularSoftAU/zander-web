import { createRequire } from "module";
const require = createRequire(import.meta.url);

import * as forumsController from "../../controllers/forumsController.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage, hasPermission } from "../../api/common.js";

export default function dashboardForumSiteRoutes(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  app.get("/dashboard/forums", async function (req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;

    const categories = await forumsController.getAllCategoriesAdmin();

    return res.view("dashboard/forums/list", {
      pageTitle: "Forums Management",
      config: config,
      req: req,
      features: features,
      categories: categories,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/forums/new", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;

    return res.view("dashboard/forums/editor", {
        pageTitle: "New Forum Category",
        config: config,
        req: req,
        features: features,
        category: null, // No existing category
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/dashboard/forums", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;

    const { title, description, position, requiredPermission } = req.body;
    await forumsController.createCategory(title, description, position, requiredPermission);
    return res.redirect("/dashboard/forums");
  });

  app.get("/dashboard/forums/:categoryId/edit", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;

    const { categoryId } = req.params;
    const category = await forumsController.getCategory(categoryId, req.session.user); // Using the public getCategory is fine here

    return res.view("dashboard/forums/editor", {
        pageTitle: "Edit Forum Category",
        config: config,
        req: req,
        features: features,
        category: category,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/dashboard/forums/:categoryId", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;

    const { categoryId } = req.params;
    const { title, description, position, requiredPermission } = req.body;
    await forumsController.updateCategory(categoryId, title, description, position, requiredPermission);
    return res.redirect("/dashboard/forums");
  });

  app.post("/dashboard/forums/:categoryId/delete", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;

    const { categoryId } = req.params;
    await forumsController.deleteCategory(categoryId);
    return res.redirect("/dashboard/forums");
  });
}
