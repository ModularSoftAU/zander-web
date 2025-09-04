import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { getWebAnnouncement } from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage, hasPermission, setBannerCookie } from "../api/common.js";
import validator from 'validator';

import * as forumsController from '../controllers/forumsController.js';

export default function forumSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  app.get("/forums", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;

    const categories = await forumsController.getCategories(req.session.user);

    return res.view("forums/index", {
        pageTitle: `Forums`,
        config: config,
        req: req,
        features: features,
        categories: categories,
        globalImage: null,
        announcementWeb: null,
    });
  });

  app.get("/forums/categories/:categoryId", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;

    const { categoryId } = req.params;
    if (isNaN(categoryId)) {
        return res.view("session/notFound", { pageTitle: "Not Found", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
    const result = await forumsController.getDiscussionsByCategory(categoryId, req.session.user);

    if (result.error) {
        // TODO: Create a proper error view for this
        return res.view("session/noPermission", {
            pageTitle: "No Permission",
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
        });
    }

    const canCreate = await forumsController.hasPermission(req.session.user, `forums.discussion.create.${categoryId}`);

    return res.view("forums/category", {
        pageTitle: result.category.title,
        config: config,
        req: req,
        features: features,
        category: result.category,
        discussions: result.discussions,
        canCreate: canCreate,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
    });
  });

  // Route to show the new discussion form
  app.get("/forums/categories/:categoryId/discussions/new", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;
    const { categoryId } = req.params;
    if (isNaN(categoryId)) {
        return res.view("session/notFound", { pageTitle: "Not Found", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
    const canCreate = await forumsController.hasPermission(req.session.user, `forums.discussion.create.${categoryId}`);
    if (!canCreate) {
        return res.view("session/noPermission", { pageTitle: "No Permission", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }

    const category = await forumsController.getCategory(categoryId, req.session.user);
    if (!category) {
        return res.view("session/notFound", { pageTitle: "Not Found", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }

    return res.view("forums/new-discussion", {
        pageTitle: "New Discussion",
        config: config,
        req: req,
        features: features,
        category: category,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
    });
  });

  // Route to handle the creation of a new discussion
  app.post("/forums/discussions", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;
    const { categoryId, title, body } = req.body;

    const canCreate = await forumsController.hasPermission(req.session.user, `forums.discussion.create.${categoryId}`);
    if (!canCreate) {
        return res.view("session/noPermission", { pageTitle: "No Permission", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }

    const validationErrors = [];
    if (!validator.isLength(title, { min: 3, max: 255 })) {
        validationErrors.push("Title must be between 3 and 255 characters.");
    }
    if (!validator.isLength(body, { min: 10 })) {
        validationErrors.push("Post body must be at least 10 characters long.");
    }

    if (validationErrors.length > 0) {
        const category = await forumsController.getCategory(categoryId, req.session.user);
        return res.view("forums/new-discussion", {
            pageTitle: "New Discussion",
            config: config,
            req: req,
            features: features,
            category: category,
            errors: validationErrors,
            title: title,
            body: body,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
        });
    }

    const result = await forumsController.createDiscussion(categoryId, title, body, req.session.user);

    if (result.error) {
        // TODO: Show error to user on the form page
        return res.send(result.error);
    }
    return res.redirect(`/forums/discussions/${result.uuid}`);
  });

  // Route to handle the creation of a new reply
  app.post("/forums/replies", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;
    const { discussionId, body } = req.body;

    if (!validator.isLength(body, { min: 10 })) {
        await setBannerCookie('danger', 'Reply must be at least 10 characters long.', res);
        return res.redirect('back');
    }

    // Permission to reply is implicitly checked in createReply by seeing if the discussion is locked
    const result = await forumsController.createReply(discussionId, body, req.session.user);

    if (result.error) {
        await setBannerCookie('danger', result.error, res);
        return res.redirect('back');
    }

    await setBannerCookie('success', 'Reply posted successfully.', res);
    return res.redirect('back');
  });

  app.post("/forums/discussions/:discussionId/lock", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;
    const { discussionId } = req.params;
    if (isNaN(discussionId)) return res.redirect('back');
    const canLock = await forumsController.hasPermission(req.session.user, 'forums.discussion.lock');
    if (!canLock) {
        return res.view("session/noPermission", { pageTitle: "No Permission", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
    await forumsController.toggleDiscussionLocked(discussionId, req.session.user);
    return res.redirect('back');
  });

  app.post("/forums/discussions/:discussionId/sticky", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;
    const { discussionId } = req.params;
    if (isNaN(discussionId)) return res.redirect('back');
    const canSticky = await forumsController.hasPermission(req.session.user, 'forums.discussion.sticky');
    if (!canSticky) {
        return res.view("session/noPermission", { pageTitle: "No Permission", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
    await forumsController.toggleDiscussionStickied(discussionId, req.session.user);
    return res.redirect('back');
  });

  app.post("/forums/revisions/:revisionId/archive", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;
    const { revisionId } = req.params;
    if (isNaN(revisionId)) return res.redirect('back');
    const canArchive = await forumsController.hasPermission(req.session.user, 'forums.post.archive');
    if (!canArchive) {
        return res.view("session/noPermission", { pageTitle: "No Permission", config, req, features, globalImage: await getGlobalImage(), announcementWeb: await getWebAnnouncement() });
    }
    await forumsController.archiveRevision(revisionId, req.session.user);
    return res.redirect('back');
  });

  app.get("/forums/discussions/:discussionUuid", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.forums, req, res, features))) return;

    const { discussionUuid } = req.params;
    const result = await forumsController.getDiscussion(discussionUuid, req.session.user);

    if (result.error) {
        // TODO: Create a proper error view for this
        return res.view("session/noPermission", {
            pageTitle: "No Permission",
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
        });
    }

    const canLock = await forumsController.hasPermission(req.session.user, 'forums.discussion.lock');
    const canSticky = await forumsController.hasPermission(req.session.user, 'forums.discussion.sticky');
    const canArchive = await forumsController.hasPermission(req.session.user, 'forums.post.archive');

    return res.view("forums/discussion", {
        pageTitle: result.discussion.title,
        config: config,
        req: req,
        features: features,
        discussion: result.discussion,
        replies: result.replies,
        canLock,
        canSticky,
        canArchive,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
    });
  });
}
