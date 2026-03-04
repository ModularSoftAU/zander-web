import {
  getCategoriesForUser,
  getCategoryBySlug,
  getDiscussionWithCategory,
  getDiscussionPosts,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  createReply,
  updatePost,
  deletePost,
  getPostById,
  getRecentDiscussions,
  getCategoryDiscussions,
  setDiscussionFlags,
  permissionMatch,
  getPostRevisions,
  moveDiscussion,
  getAllCategoriesForAdmin,
} from "../controllers/forumController.js";
import {
  getGlobalImage,
  isFeatureWebRouteEnabled,
  isLoggedIn,
  setBannerCookie,
} from "../api/common.js";
import { UserGetter } from "../controllers/userController.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { sendWebhookMessage } from "../lib/discord/webhooks.mjs";
import { hasActiveWebBan } from "../controllers/discordPunishmentController.js";

const PERMISSIONS = {
  MODERATE: "zander.forums.moderate",
  DELETE_POST: "zander.forums.post.delete",
  VIEW_ARCHIVED: "zander.forums.viewArchived",
  STICKY: "zander.forums.discussion.sticky",
  LOCK: "zander.forums.discussion.lock",
  ARCHIVE: "zander.forums.discussion.archive",
};

function getUserPermissions(req) {
  const permissions = Array.isArray(req.session?.user?.permissions)
    ? [...req.session.user.permissions]
    : [];

  // Add @authenticated pseudo-permission for logged-in users
  // This allows categories to require login by setting viewPermission to "@authenticated"
  if (isLoggedIn(req)) {
    permissions.push("@authenticated");
  }

  return permissions;
}

function getCurrentUserId(req) {
  return req.session?.user?.userId || null;
}

function isContentEmpty(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return true;
  }

  const stripped = String(rawValue)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return stripped.length === 0;
}

function userCanViewCategory(category, req) {
  // Special permission: @authenticated means user must be logged in
  if (category.viewPermission === "@authenticated") {
    return isLoggedIn(req);
  }
  const permissions = getUserPermissions(req);
  return permissionMatch(permissions, category.viewPermission);
}

function userCanPostInCategory(category, req) {
  if (!isLoggedIn(req)) {
    return false;
  }

  if (!category.postPermission) {
    return true;
  }

  // Special permission: @authenticated means any logged-in user can post
  if (category.postPermission === "@authenticated") {
    return true;
  }

  const permissions = getUserPermissions(req);
  return permissionMatch(permissions, category.postPermission);
}

function userCanModerate(req) {
  const permissions = getUserPermissions(req);
  return permissionMatch(permissions, PERMISSIONS.MODERATE);
}

function userCanDeleteAnyPost(req) {
  const permissions = getUserPermissions(req);
  return (
    permissionMatch(permissions, PERMISSIONS.DELETE_POST) ||
    permissionMatch(permissions, PERMISSIONS.MODERATE)
  );
}

function includeArchivedDiscussions(req) {
  const permissions = getUserPermissions(req);
  return (
    permissionMatch(permissions, PERMISSIONS.MODERATE) ||
    permissionMatch(permissions, PERMISSIONS.VIEW_ARCHIVED)
  );
}

function userCanSticky(req) {
  const permissions = getUserPermissions(req);
  return (
    permissionMatch(permissions, PERMISSIONS.STICKY) ||
    permissionMatch(permissions, PERMISSIONS.MODERATE)
  );
}

function userCanLock(req) {
  const permissions = getUserPermissions(req);
  return (
    permissionMatch(permissions, PERMISSIONS.LOCK) ||
    permissionMatch(permissions, PERMISSIONS.MODERATE)
  );
}

function userCanArchive(req) {
  const permissions = getUserPermissions(req);
  return (
    permissionMatch(permissions, PERMISSIONS.ARCHIVE) ||
    permissionMatch(permissions, PERMISSIONS.MODERATE)
  );
}

function paginate(total, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return {
    total,
    perPage,
    currentPage,
    totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}

function getSiteBaseUrl(req) {
  const configuredAddress =
    typeof process.env.siteAddress === "string"
      ? process.env.siteAddress.trim()
      : "";

  if (configuredAddress) {
    return configuredAddress.replace(/\/$/, "");
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol =
    req.headers["x-forwarded-proto"] || req.protocol || "https";

  if (protocol && host) {
    return `${protocol}://${host}`;
  }

  return "";
}

function buildPostPermalink(req, discussion, postId) {
  if (!discussion || !postId) {
    return "";
  }

  const baseUrl = getSiteBaseUrl(req);
  if (!baseUrl) {
    return "";
  }

  const slug = discussion.slug ? `/${discussion.slug}` : "";
  return `${baseUrl}/forums/discussion/${discussion.discussionId}${slug}#post-${postId}`;
}

const FORUM_LOG_COLORS = {
  create: 2278750,    // 0x22c55e - green
  reply: 3900150,     // 0x3b82f6 - blue
  edit: 16096779,     // 0xf59e0b - amber
  delete: 15680580,    // 0xef4444 - red
  lock: 16347926,     // 0xf97316 - orange
  unlock: 2278750,    // 0x22c55e - green
  sticky: 11032055,   // 0xa855f7 - purple
  unsticky: 7041664, // 0x6b7280 - gray
  archive: 6583435,   // 0x64748b - slate
  unarchive: 2278750, // 0x22c55e - green
  report: 14427686,   // 0xdc2626 - red
};

function stripHtmlAndTruncate(html, maxLength = 200) {
  if (!html) return "";
  const text = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

function sendForumLog(config, { action, title, description, url, avatarUrl, fields }) {
  const webhookUrl = config.discord?.webhooks?.forumLog;
  if (!webhookUrl) return;

  try {
    const hook = new Webhook(webhookUrl);
    const embed = new MessageBuilder()
      .setTitle(title)
      .setColor(FORUM_LOG_COLORS[action] || 0x6b7280)
      .setTimestamp();

    if (description) embed.setDescription(description);
    if (url) embed.setURL(url);
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    if (fields) {
      fields.forEach(([name, value, inline]) => {
        if (value) embed.addField(name, value, inline ?? true);
      });
    }

    sendWebhookMessage(hook, embed, { context: `forums#${action}` });
  } catch (err) {
    console.error("Failed to send forum log webhook", err);
  }
}

async function renderForumsView(res, req, viewPath, data, config, features) {
  const [globalImage, announcementWeb] = await Promise.all([
    getGlobalImage(),
    getWebAnnouncement(),
  ]);

  return res.view(viewPath, {
    ...data,
    config,
    features,
    req,
    globalImage,
    announcementWeb,
  });
}

export default function forumRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  const ensureFeature = async (req, res) => {
    if (!features.forums) {
      await isFeatureWebRouteEnabled(features.forums, req, res, features);
      return false;
    }

    return true;
  };

  const userGetter = new UserGetter();

  app.get("/fourms", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    return res.redirect(301, "/forums");
  });

  app.get("/forums", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const permissions = getUserPermissions(req);
    const includeArchived = includeArchivedDiscussions(req);
    const categoryData = await getCategoriesForUser(permissions);
    const categoryIds = (categoryData.flat || []).map(
      (category) => category.categoryId
    );

    const page = Number.parseInt(req.query.page, 10) || 1;
    const perPage = 20;

    const { discussions, total } = await getRecentDiscussions({
      categoryIds,
      page,
      perPage,
      includeArchived,
    });

    return renderForumsView(
      res,
      req,
      "modules/forums/index",
      {
        pageTitle: `Recent Discussions`,
        categories: categoryData.tree,
        discussions,
        activeCategory: null,
        pagination: paginate(total, page, perPage),
        moment,
        canModerate: userCanModerate(req),
      },
      config,
      features
    );
  });

  app.get("/forums/category/:slug", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const slug = req.params.slug;
    const category = await getCategoryBySlug(slug);

    const permissions = getUserPermissions(req);
    const categoryTree = await getCategoriesForUser(permissions);

    if (!category || !userCanViewCategory(category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    const includeArchived = includeArchivedDiscussions(req);
    const page = Number.parseInt(req.query.page, 10) || 1;
    const perPage = 20;

    const { discussions, total } = await getCategoryDiscussions({
      categoryId: category.categoryId,
      page,
      perPage,
      includeArchived,
    });

    return renderForumsView(
      res,
      req,
      "modules/forums/category",
      {
        pageTitle: `${category.name}`,
        categories: categoryTree.tree,
        activeCategory: category,
        category,
        discussions,
        pagination: paginate(total, page, perPage),
        moment,
        canModerate: userCanModerate(req),
        canStartDiscussion:
          userCanPostInCategory(category, req) || userCanModerate(req),
      },
      config,
      features
    );
  });

  app.get("/forums/category/:slug/new", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const slug = req.params.slug;
    const category = await getCategoryBySlug(slug);

    if (!category || !userCanViewCategory(category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    if (!userCanPostInCategory(category, req) && !userCanModerate(req)) {
      if (!isLoggedIn(req)) {
        await setBannerCookie(
          "warning",
          "You need to be signed in to start a discussion.",
          res
        );
        return res.redirect(`/login`);
      }

      return renderForumsView(
        res,
        req,
        "session/noPermission",
        {
          pageTitle: `Access Restricted`,
        },
        config,
        features
      );
    }

    const permissions = getUserPermissions(req);
    const categoryTree = await getCategoriesForUser(permissions);

    return renderForumsView(
      res,
      req,
      "modules/forums/newDiscussion",
      {
        pageTitle: `Start a Discussion`,
        categories: categoryTree.tree,
        activeCategory: category,
        category,
      },
      config,
      features
    );
  });

  app.post("/forums/category/:slug", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (await hasActiveWebBan(getCurrentUserId(req))) {
      await setBannerCookie("danger", "You are currently banned and cannot create discussions.", res);
      return res.redirect("/forums");
    }

    const slug = req.params.slug;
    const category = await getCategoryBySlug(slug);

    if (!category || !userCanViewCategory(category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    if (!userCanPostInCategory(category, req) && !userCanModerate(req)) {
      await setBannerCookie(
        "danger",
        "You do not have permission to start a discussion in this category.",
        res
      );
      return res.redirect(`/forums/category/${category.slug}`);
    }

    const title = (req.body.title || "").trim();
    const content = req.body.content || "";

    const userId = getCurrentUserId(req);

    if (!userId) {
      await setBannerCookie(
        "warning",
        "You need to be signed in to start a discussion.",
        res
      );
      return res.redirect(`/login`);
    }

    if (!title || isContentEmpty(content)) {
      await setBannerCookie(
        "danger",
        "Both a title and content are required to create a discussion.",
        res
      );
      return res.redirect(`/forums/category/${category.slug}/new`);
    }

    try {
      const discussion = await createDiscussion({
        categoryId: category.categoryId,
        userId,
        title,
        content,
      });

      const baseUrl = getSiteBaseUrl(req);
      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      const contentSnippet = stripHtmlAndTruncate(content);
      sendForumLog(config, {
        action: "create",
        title: "New Discussion Created",
        description: `**${title}**`,
        url: baseUrl ? `${baseUrl}/forums/discussion/${discussion.discussionId}/${discussion.slug}` : undefined,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Author", username],
          ["Category", category.name],
          ["Content", contentSnippet || "—", false],
        ],
      });

      await setBannerCookie(
        "success",
        "Discussion created successfully.",
        res
      );

      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    } catch (error) {
      console.error("[FORUMS] Failed to create discussion", error);
      await setBannerCookie(
        "danger",
        "We were unable to create your discussion. Please try again.",
        res
      );
      return res.redirect(`/forums/category/${category.slug}`);
    }
  });

  const discussionViewHandler = async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const discussionId = Number.parseInt(req.params.discussionId, 10);
    const result = await getDiscussionWithCategory(discussionId);

    if (!result) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    const { discussion, category } = result;

    if (!userCanViewCategory(category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    if (req.params.slug && req.params.slug !== discussion.slug) {
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    const permissions = getUserPermissions(req);
    const canModerate = userCanModerate(req);

    const [categoryTree, posts, allCategories] = await Promise.all([
      getCategoriesForUser(permissions),
      getDiscussionPosts(discussionId),
      canModerate ? getAllCategoriesForAdmin() : Promise.resolve({ flat: [] }),
    ]);

    const canReply =
      !discussion.isLocked &&
      !discussion.isArchived &&
      (userCanPostInCategory(category, req) || canModerate);

    return renderForumsView(
      res,
      req,
      "modules/forums/discussion",
      {
        pageTitle: `${discussion.title}`,
        categories: categoryTree.tree,
        activeCategory: category,
        category,
        discussion,
        posts,
        moment,
        canReply,
        canModerate,
        canSticky: userCanSticky(req),
        canLock: userCanLock(req),
        canArchive: userCanArchive(req),
        currentUserId: req.session?.user?.userId || null,
        canDeleteAnyPost: userCanDeleteAnyPost(req),
        moveCategories: allCategories.flat,
      },
      config,
      features
    );
  };

  app.get("/forums/discussion/:discussionId", discussionViewHandler);
  app.get("/forums/discussion/:discussionId/:slug", discussionViewHandler);

  const discussionReplyHandler = async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (await hasActiveWebBan(getCurrentUserId(req))) {
      await setBannerCookie("danger", "You are currently banned and cannot post replies.", res);
      return res.redirect("/forums");
    }

    const discussionId = Number.parseInt(req.params.discussionId, 10);
    const result = await getDiscussionWithCategory(discussionId);

    if (!result) {
      await setBannerCookie("danger", "Discussion not found.", res);
      return res.redirect("/forums");
    }

    const { discussion, category } = result;

    if (!userCanViewCategory(category, req)) {
      await setBannerCookie("danger", "You cannot reply to this discussion.", res);
      return res.redirect("/forums");
    }

    if (discussion.isLocked && !userCanModerate(req)) {
      await setBannerCookie("warning", "This discussion is locked.", res);
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    if (discussion.isArchived && !userCanModerate(req)) {
      await setBannerCookie(
        "warning",
        "This discussion has been archived.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    const userId = getCurrentUserId(req);

    if (!userId) {
      await setBannerCookie(
        "warning",
        "You need to be signed in to reply.",
        res
      );
      return res.redirect(`/login`);
    }

    if (!userCanPostInCategory(category, req) && !userCanModerate(req)) {
      await setBannerCookie(
        "danger",
        "You do not have permission to reply in this category.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    const content = req.body.content || "";
    if (isContentEmpty(content)) {
      await setBannerCookie(
        "danger",
        "Reply content cannot be empty.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    try {
      await createReply({
        discussionId,
        userId,
        content,
      });

      const baseUrl = getSiteBaseUrl(req);
      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      const contentSnippet = stripHtmlAndTruncate(content);
      sendForumLog(config, {
        action: "reply",
        title: "New Reply Posted",
        description: `Reply to **${discussion.title || `Discussion #${discussionId}`}**`,
        url: baseUrl ? `${baseUrl}/forums/discussion/${discussion.discussionId}/${discussion.slug}` : undefined,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Author", username],
          ["Category", category?.name || "Unknown"],
          ["Content", contentSnippet || "—", false],
        ],
      });

      await setBannerCookie("success", "Reply posted.", res);
    } catch (error) {
      console.error("[FORUMS] Failed to create reply", error);
      await setBannerCookie(
        "danger",
        "We were unable to post your reply. Please try again.",
        res
      );
    }

    return res.redirect(
      `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
    );
  };

  app.post("/forums/discussion/:discussionId/reply", discussionReplyHandler);
  app.post(
    "/forums/discussion/:discussionId/:slug/reply",
    discussionReplyHandler
  );

  app.get("/forums/discussion/:discussionId/edit", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const discussionId = Number.parseInt(req.params.discussionId, 10);
    const result = await getDiscussionWithCategory(discussionId);

    if (!result) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    const { discussion, category } = result;

    if (!userCanViewCategory(category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    const canModerate = userCanModerate(req);
    const isAuthor = getCurrentUserId(req) === discussion.createdBy;

    if (!canModerate && !isAuthor) {
      return renderForumsView(
        res,
        req,
        "session/noPermission",
        {
          pageTitle: `Access Restricted`,
        },
        config,
        features
      );
    }

    const permissions = getUserPermissions(req);
    const [posts, categoryTree] = await Promise.all([
      getDiscussionPosts(discussionId),
      getCategoriesForUser(permissions),
    ]);
    const originalPost = posts.find((post) => post.isOriginal);

    return renderForumsView(
      res,
      req,
      "modules/forums/editDiscussion",
      {
        pageTitle: `Edit Discussion`,
        categories: categoryTree.tree,
        activeCategory: category,
        category,
        discussion,
        originalPost,
      },
      config,
      features
    );
  });

  app.post("/forums/discussion/:discussionId/edit", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (await hasActiveWebBan(getCurrentUserId(req))) {
      await setBannerCookie("danger", "You are currently banned and cannot edit discussions.", res);
      return res.redirect("/forums");
    }

    const discussionId = Number.parseInt(req.params.discussionId, 10);
    const result = await getDiscussionWithCategory(discussionId);

    if (!result) {
      await setBannerCookie("danger", "Discussion not found.", res);
      return res.redirect("/forums");
    }

    const { discussion, category } = result;

    const canModerate = userCanModerate(req);
    const isAuthor = req.session?.user?.userId === discussion.createdBy;

    if (!canModerate && !isAuthor) {
      await setBannerCookie(
        "danger",
        "You do not have permission to edit this discussion.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    const title = (req.body.title || "").trim();
    const content = req.body.content || "";

    if (!title || isContentEmpty(content)) {
      await setBannerCookie(
        "danger",
        "A title and body are required.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    try {
      await updateDiscussion(discussionId, {
        title,
        content,
        editorUserId: getCurrentUserId(req),
      });

      const baseUrl = getSiteBaseUrl(req);
      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      const contentSnippet = stripHtmlAndTruncate(content);
      sendForumLog(config, {
        action: "edit",
        title: "Discussion Edited",
        description: `**${title}**`,
        url: baseUrl ? `${baseUrl}/forums/discussion/${discussion.discussionId}/${discussion.slug}` : undefined,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Edited By", username],
          ["Category", category?.name || "Unknown"],
          ["Content", contentSnippet || "—", false],
        ],
      });

      await setBannerCookie("success", "Discussion updated.", res);
    } catch (error) {
      console.error("[FORUMS] Failed to update discussion", error);
      await setBannerCookie(
        "danger",
        "We were unable to update the discussion.",
        res
      );
    }

    return res.redirect(
      `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
    );
  });

  app.post("/forums/discussion/:discussionId/delete", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (await hasActiveWebBan(getCurrentUserId(req))) {
      await setBannerCookie("danger", "You are currently banned and cannot delete discussions.", res);
      return res.redirect("/forums");
    }

    const discussionId = Number.parseInt(req.params.discussionId, 10);
    const result = await getDiscussionWithCategory(discussionId);

    if (!result) {
      await setBannerCookie("danger", "Discussion not found.", res);
      return res.redirect("/forums");
    }

    const { discussion, category } = result;

    const canModerate = userCanModerate(req);
    const isAuthor = getCurrentUserId(req) === discussion.createdBy;

    if (!canModerate && !isAuthor) {
      await setBannerCookie(
        "danger",
        "You do not have permission to delete this discussion.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }

    try {
      await deleteDiscussion(discussionId);

      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      sendForumLog(config, {
        action: "delete",
        title: "Discussion Deleted",
        description: `**${discussion.title || `Discussion #${discussionId}`}**`,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Deleted By", username],
          ["Category", category?.name || "Unknown"],
        ],
      });

      await setBannerCookie("success", "Discussion deleted.", res);
      return res.redirect(`/forums/category/${category.slug}`);
    } catch (error) {
      console.error("[FORUMS] Failed to delete discussion", error);
      await setBannerCookie(
        "danger",
        "We were unable to delete the discussion.",
        res
      );
      return res.redirect(
        `/forums/discussion/${discussion.discussionId}/${discussion.slug}`
      );
    }
  });

  app.get("/forums/post/:postId/edit", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const postId = Number.parseInt(req.params.postId, 10);
    const post = await getPostById(postId);

    if (!post) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    const result = await getDiscussionWithCategory(post.discussionId);

    if (!result || !userCanViewCategory(result.category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    if (post.isOriginal) {
      return res.redirect(
        `/forums/discussion/${post.discussionId}/edit`
      );
    }

    const canModerate = userCanModerate(req);
    const isAuthor = getCurrentUserId(req) === post.userId;

    if (!canModerate && !isAuthor) {
      return renderForumsView(
        res,
        req,
        "session/noPermission",
        {
          pageTitle: `Access Restricted`,
        },
        config,
        features
      );
    }

    const permissions = getUserPermissions(req);
    const categoryTree = await getCategoriesForUser(permissions);

    return renderForumsView(
      res,
      req,
      "modules/forums/editPost",
      {
        pageTitle: `Edit Reply`,
        categories: categoryTree.tree,
        activeCategory: result.category,
        category: result.category,
        discussion: result.discussion,
        post,
      },
      config,
      features
    );
  });

  app.post("/forums/post/:postId/edit", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (await hasActiveWebBan(getCurrentUserId(req))) {
      await setBannerCookie("danger", "You are currently banned and cannot edit posts.", res);
      return res.redirect("/forums");
    }

    const postId = Number.parseInt(req.params.postId, 10);
    const post = await getPostById(postId);

    if (!post) {
      await setBannerCookie("danger", "Post not found.", res);
      return res.redirect("/forums");
    }

    if (post.isOriginal) {
      return res.redirect(`/forums/discussion/${post.discussionId}/edit`);
    }

    const result = await getDiscussionWithCategory(post.discussionId);

    if (!result || !userCanViewCategory(result.category, req)) {
      await setBannerCookie(
        "danger",
        "You do not have permission to edit this post.",
        res
      );
      return res.redirect("/forums");
    }

    const canModerate = userCanModerate(req);
    const isAuthor = getCurrentUserId(req) === post.userId;

    if (!canModerate && !isAuthor) {
      await setBannerCookie(
        "danger",
        "You do not have permission to edit this post.",
        res
      );
      return res.redirect(
        `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
      );
    }

    const content = req.body.content || "";
    if (isContentEmpty(content)) {
      await setBannerCookie("danger", "Post content cannot be empty.", res);
      return res.redirect(
        `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
      );
    }

    try {
      await updatePost(postId, {
        content,
        editorUserId: getCurrentUserId(req),
      });

      const baseUrl = getSiteBaseUrl(req);
      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      const contentSnippet = stripHtmlAndTruncate(content);
      sendForumLog(config, {
        action: "edit",
        title: "Reply Edited",
        description: `Reply in **${result.discussion.title || `Discussion #${result.discussion.discussionId}`}**`,
        url: baseUrl ? `${baseUrl}/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}#post-${postId}` : undefined,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Edited By", username],
          ["Content", contentSnippet || "—", false],
        ],
      });

      await setBannerCookie("success", "Post updated.", res);
    } catch (error) {
      console.error("[FORUMS] Failed to update post", error);
      await setBannerCookie(
        "danger",
        "We were unable to update the post.",
        res
      );
    }

    return res.redirect(
      `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
    );
  });

  app.post("/forums/post/:postId/delete", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (await hasActiveWebBan(getCurrentUserId(req))) {
      await setBannerCookie("danger", "You are currently banned and cannot delete posts.", res);
      return res.redirect("/forums");
    }

    const postId = Number.parseInt(req.params.postId, 10);
    const post = await getPostById(postId);

    if (!post) {
      await setBannerCookie("danger", "Post not found.", res);
      return res.redirect("/forums");
    }

    const result = await getDiscussionWithCategory(post.discussionId);

    if (!result || !userCanViewCategory(result.category, req)) {
      await setBannerCookie(
        "danger",
        "You do not have permission to delete this post.",
        res
      );
      return res.redirect("/forums");
    }

    if (post.isOriginal) {
      await setBannerCookie(
        "danger",
        "The first post in a discussion cannot be deleted individually.",
        res
      );
      return res.redirect(
        `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
      );
    }

    const canModerate = userCanModerate(req);
    const isAuthor = getCurrentUserId(req) === post.userId;

    if (!canModerate && !isAuthor && !userCanDeleteAnyPost(req)) {
      await setBannerCookie(
        "danger",
        "You do not have permission to delete this post.",
        res
      );
      return res.redirect(
        `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
      );
    }

    try {
      await deletePost(postId);

      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      sendForumLog(config, {
        action: "delete",
        title: "Reply Deleted",
        description: `Reply removed from **${result.discussion.title || `Discussion #${result.discussion.discussionId}`}**`,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Deleted By", username],
        ],
      });

      await setBannerCookie("success", "Post deleted.", res);
    } catch (error) {
      console.error("[FORUMS] Failed to delete post", error);
      await setBannerCookie(
        "danger",
        "We were unable to delete the post.",
        res
      );
    }

    return res.redirect(
      `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
    );
  });

  app.post("/forums/post/:postId/report", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    if (!features.report) {
      res.status(404);
      return res.send({
        success: false,
        message: "Reporting is currently disabled.",
      });
    }

    if (!isLoggedIn(req)) {
      res.status(401);
      return res.send({
        success: false,
        message: "You must be logged in to report forum posts.",
      });
    }

    const postId = Number.parseInt(req.params.postId, 10);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400);
      return res.send({
        success: false,
        message: "Invalid post identifier.",
      });
    }

    const rawReason =
      typeof req.body?.reportReason === "string" ? req.body.reportReason : "";
    const reason = rawReason.trim();

    if (!reason) {
      res.status(400);
      return res.send({
        success: false,
        message: "Please provide a reason for your report.",
      });
    }

    const rawDetails =
      typeof req.body?.reportReasonEvidence === "string"
        ? req.body.reportReasonEvidence
        : "";
    const details = rawDetails.trim();

    try {
      const post = await getPostById(postId);
      if (!post) {
        res.status(404);
        return res.send({
          success: false,
          message: "Post not found.",
        });
      }

      const info = await getDiscussionWithCategory(post.discussionId);
      if (!info || !info.discussion || !info.category) {
        res.status(404);
        return res.send({
          success: false,
          message: "Discussion not found.",
        });
      }

      if (!userCanViewCategory(info.category, req)) {
        res.status(403);
        return res.send({
          success: false,
          message: "You do not have permission to report this post.",
        });
      }

      const author = post.userId ? await userGetter.byUserId(post.userId) : null;
      if (!author || !author.username) {
        res.status(404);
        return res.send({
          success: false,
          message: "Unable to resolve the post author.",
        });
      }

      const truncatedReason = reason.length > 100 ? reason.slice(0, 100) : reason;
      const permalink = buildPostPermalink(req, info.discussion, post.postId);
      const evidenceParts = [];

      if (permalink) {
        evidenceParts.push(`Forum link: ${permalink}`);
      }

      if (details) {
        evidenceParts.push(details);
      }

      const reporterUsername = req.session?.user?.username;
      if (!reporterUsername) {
        res.status(401);
        return res.send({
          success: false,
          message: "You must be logged in to report forum posts.",
        });
      }

      const reportBody = {
        reporterUser: reporterUsername,
        reportedUser: author.username,
        reportReason: truncatedReason,
        reportReasonEvidence: evidenceParts.join("\n\n") || null,
        reportPlatform: "FORUM",
      };

      const apiResponse = await fetch(
        `${process.env.siteAddress}/api/report/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-access-token": process.env.apiKey,
          },
          body: JSON.stringify(reportBody),
        }
      );

      const data = await apiResponse.json().catch(() => null);

      if (!apiResponse.ok || !data?.success) {
        const message =
          data?.message ||
          "Unable to submit your report right now. Please try again later.";

        res.status(apiResponse.status >= 400 ? apiResponse.status : 500);
        return res.send({
          success: false,
          message,
        });
      }

      const uuid = req.session?.user?.uuid;
      sendForumLog(config, {
        action: "report",
        title: "Post Reported",
        description: `A post by **${author?.username || "Unknown"}** was reported`,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [
          ["Reported By", reporterUsername],
          ["Reason", truncatedReason, false],
        ],
      });

      return res.send({
        success: true,
        message:
          data.message || "Thanks for letting us know. Your report has been received.",
      });
    } catch (error) {
      console.error("Failed to submit forum report:", error);
      res.status(500);
      return res.send({
        success: false,
        message: "An unexpected error occurred while submitting your report.",
      });
    }
  });

  app.post(
    "/forums/discussion/:discussionId/moderate",
    async function (req, res) {
      if (!(await ensureFeature(req, res))) {
        return;
      }

      const discussionId = Number.parseInt(req.params.discussionId, 10);
      const result = await getDiscussionWithCategory(discussionId);

      if (!result) {
        await setBannerCookie("danger", "Discussion not found.", res);
        return res.redirect("/forums");
      }

      const action = (req.body.action || "").toLowerCase();

      // Check specific permissions based on action
      let hasPermission = false;
      let permissionMessage = "You do not have permission to perform this action.";

      if (action === "lock" || action === "unlock") {
        hasPermission = userCanLock(req);
        permissionMessage = "You do not have permission to lock or unlock discussions.";
      } else if (action === "sticky" || action === "unsticky") {
        hasPermission = userCanSticky(req);
        permissionMessage = "You do not have permission to pin or unpin discussions.";
      } else if (action === "archive" || action === "unarchive") {
        hasPermission = userCanArchive(req);
        permissionMessage = "You do not have permission to archive or unarchive discussions.";
      }

      if (!hasPermission) {
        await setBannerCookie("danger", permissionMessage, res);
        return res.redirect(
          `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
        );
      }

      const updates = {};
      if (action === "lock") updates.isLocked = true;
      if (action === "unlock") updates.isLocked = false;
      if (action === "sticky") updates.isSticky = true;
      if (action === "unsticky") updates.isSticky = false;
      if (action === "archive") updates.isArchived = true;
      if (action === "unarchive") updates.isArchived = false;

      if (!Object.keys(updates).length) {
        await setBannerCookie(
          "warning",
          "Unknown moderation action.",
          res
        );
        return res.redirect(
          `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
        );
      }

      try {
        await setDiscussionFlags(discussionId, updates);

        const actionLabels = {
          lock: "Discussion Locked",
          unlock: "Discussion Unlocked",
          sticky: "Discussion Pinned",
          unsticky: "Discussion Unpinned",
          archive: "Discussion Archived",
          unarchive: "Discussion Unarchived",
        };

        const baseUrl = getSiteBaseUrl(req);
        const username = req.session?.user?.username || "Unknown";
        const uuid = req.session?.user?.uuid;
        sendForumLog(config, {
          action,
          title: actionLabels[action] || `Discussion ${action}`,
          description: `**${result.discussion.title || `Discussion #${discussionId}`}**`,
          url: baseUrl ? `${baseUrl}/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}` : undefined,
          avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
          fields: [
            ["Action By", username],
          ],
        });

        await setBannerCookie("success", "Discussion updated.", res);
      } catch (error) {
        console.error("[FORUMS] Failed to update discussion flags", error);
        await setBannerCookie(
          "danger",
          "Unable to update the discussion state.",
          res
        );
      }

      return res.redirect(
        `/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`
      );
    }
  );

  app.post("/forums/discussion/:discussionId/move", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const discussionId = Number.parseInt(req.params.discussionId, 10);
    const result = await getDiscussionWithCategory(discussionId);

    if (!result) {
      return renderForumsView(res, req, "session/notFound", { pageTitle: `404 Not Found` }, config, features);
    }

    if (!userCanModerate(req)) {
      return renderForumsView(res, req, "session/noPermission", { pageTitle: `Access Restricted` }, config, features);
    }

    const newCategoryId = Number.parseInt(req.body.categoryId, 10);
    if (!newCategoryId || newCategoryId === result.discussion.categoryId) {
      await setBannerCookie("warning", "Please select a different category.", res);
      return res.redirect(`/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`);
    }

    try {
      await moveDiscussion(discussionId, newCategoryId);

      const baseUrl = getSiteBaseUrl(req);
      const username = req.session?.user?.username || "Unknown";
      const uuid = req.session?.user?.uuid;
      sendForumLog(config, {
        action: "move",
        title: "Discussion Moved",
        description: `**${result.discussion.title}** moved to a new category`,
        url: baseUrl ? `${baseUrl}/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}` : undefined,
        avatarUrl: uuid ? `https://crafthead.net/helm/${uuid}` : undefined,
        fields: [["Moved By", username]],
      });

      await setBannerCookie("success", "Discussion moved to the new category.", res);
    } catch (error) {
      console.error("[FORUMS] Failed to move discussion", error);
      await setBannerCookie("danger", "Unable to move the discussion.", res);
    }

    return res.redirect(`/forums/discussion/${result.discussion.discussionId}/${result.discussion.slug}`);
  });

  app.get("/forums/post/:postId/revisions", async function (req, res) {
    if (!(await ensureFeature(req, res))) {
      return;
    }

    const postId = Number.parseInt(req.params.postId, 10);
    const post = await getPostById(postId);

    if (!post) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    const result = await getDiscussionWithCategory(post.discussionId);

    if (!result || !userCanViewCategory(result.category, req)) {
      return renderForumsView(
        res,
        req,
        "session/notFound",
        {
          pageTitle: `404 Not Found`,
        },
        config,
        features
      );
    }

    if (!userCanModerate(req)) {
      return renderForumsView(
        res,
        req,
        "session/noPermission",
        {
          pageTitle: `Access Restricted`,
        },
        config,
        features
      );
    }

    const revisions = await getPostRevisions(postId);

    const permissions = getUserPermissions(req);
    const categoryTree = await getCategoriesForUser(permissions);

    return renderForumsView(
      res,
      req,
      "modules/forums/revisions",
      {
        pageTitle: `Post Revisions`,
        categories: categoryTree.tree,
        activeCategory: result.category,
        category: result.category,
        discussion: result.discussion,
        post,
        revisions,
        moment,
      },
      config,
      features
    );
  });
}
