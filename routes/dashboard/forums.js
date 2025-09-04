import { createRequire } from "module";
const require = createRequire(import.meta.url);

import * as forumsController from "../../controllers/forumsController.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../../api/common.js";
import { checkAuth } from "../../controllers/sessionController.js";

export default function dashboardForumSiteRoutes(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  app.get("/dashboard/forums", checkAuth, async function (req, res) {
    // TODO: Add permission check: if (!forumsController.hasPermission(req.session.user, 'admin.forums.manage')) ...

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

  app.get("/dashboard/forums/new", checkAuth, async function(req, res) {
    // TODO: Permission check
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

  app.post("/dashboard/forums", checkAuth, async function(req, res) {
    // TODO: Permission check
    const { title, description, position, requiredPermission } = req.body;
    await forumsController.createCategory(title, description, position, requiredPermission);
    return res.redirect("/dashboard/forums");
  });

  app.get("/dashboard/forums/:categoryId/edit", checkAuth, async function(req, res) {
    // TODO: Permission check
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

  app.post("/dashboard/forums/:categoryId", checkAuth, async function(req, res) {
    // TODO: Permission check
    const { categoryId } = req.params;
    const { title, description, position, requiredPermission } = req.body;
    await forumsController.updateCategory(categoryId, title, description, position, requiredPermission);
    return res.redirect("/dashboard/forums");
  });

  app.post("/dashboard/forums/:categoryId/delete", checkAuth, async function(req, res) {
    // TODO: Permission check
    const { categoryId } = req.params;
    await forumsController.deleteCategory(categoryId);
    return res.redirect("/dashboard/forums");
  });
}
