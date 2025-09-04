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
    try {
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
    } catch (error) {
        console.error(`Error in /dashboard/forums route:`, error);
        return res.view("session/error", { pageTitle: "Server Error", config, req, features, error: error, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
  });

  app.get("/dashboard/forums/new", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;
    try {
        return res.view("dashboard/forums/editor", {
            pageTitle: "New Forum Category",
            config: config,
            req: req,
            features: features,
            category: null, // No existing category
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
        });
    } catch (error) {
        console.error(`Error in /dashboard/forums/new route:`, error);
        return res.view("session/error", { pageTitle: "Server Error", config, req, features, error: error, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
  });

  app.post("/dashboard/forums", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;
    try {
        const { title, description, position, requiredPermission } = req.body;
        await forumsController.createCategory(title, description, position, requiredPermission);
        return res.redirect("/dashboard/forums");
    } catch (error) {
        console.error(`Error in POST /dashboard/forums route:`, error);
        return res.redirect("/dashboard/forums"); // Or render an error page
    }
  });

  app.get("/dashboard/forums/:categoryId/edit", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;
    try {
        const { categoryId } = req.params;
        const category = await forumsController.getCategory(categoryId, req.session.user);

        return res.view("dashboard/forums/editor", {
            pageTitle: "Edit Forum Category",
            config: config,
            req: req,
            features: features,
            category: category,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
        });
    } catch (error) {
        console.error(`Error in /dashboard/forums/:categoryId/edit route:`, error);
        return res.view("session/error", { pageTitle: "Server Error", config, req, features, error: error, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
  });

  app.post("/dashboard/forums/:categoryId", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;
    try {
        const { categoryId } = req.params;
        const { title, description, position, requiredPermission } = req.body;
        await forumsController.updateCategory(categoryId, title, description, position, requiredPermission);
        return res.redirect("/dashboard/forums");
    } catch (error) {
        console.error(`Error in POST /dashboard/forums/:categoryId route:`, error);
        return res.redirect("/dashboard/forums");
    }
  });

  app.post("/dashboard/forums/:categoryId/delete", async function(req, res) {
    if (!hasPermission("zander.web.forums.manage", req, res, features)) return;
    try {
        const { categoryId } = req.params;
        await forumsController.deleteCategory(categoryId);
        return res.redirect("/dashboard/forums");
    } catch (error) {
        console.error(`Error in POST /dashboard/forums/:categoryId/delete route:`, error);
        return res.redirect("/dashboard/forums");
    }
  });
}
