import { getWebAnnouncement } from "../../controllers/announcementController.js";
import {
  isFeatureWebRouteEnabled,
  getGlobalImage,
  hasPermission,
} from "../../api/common.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  getSupportCategories,
  getSupportCategoriesWithPermissions,
  addCategoryPermission,
  removeCategoryPermission,
  createSupportCategory,
  deleteSupportCategory,
  getAllTickets,
  getTicketById,
  getTicketsByCategory,
  updateTicketStatus,
  notifyTicketStatusChange,
  getCategoryById,
  getCategoryPermissions,
  updateSupportCategory,
  deleteTicketChannel,
  recreateTicketChannel,
} from "../../controllers/supportTicketController.js";
import { hasPermission as hasPermissionNode } from "../../lib/discord/permissions.mjs";

export default function supportDashboardRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang,
) {
  function getSafeRedirectTarget(req) {
    const redirect =
      req.body && typeof req.body.redirect === "string"
        ? req.body.redirect
        : null;
    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }
    return "/dashboard/support/categories";
  }
  const slugifyCategory = (name, fallback = "") => {
    const source = name || fallback;
    return String(source)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const getCategorySlug = (category) => {
    if (!category) return "";
    if (category.slug) return category.slug;
    return slugifyCategory(category.name, `category-${category.categoryId}`);
  };

  const userHasCategoryPermission = (slug, permissions = []) => {
    if (!slug) return false;
    const ticketNode = `zander.web.tickets.${slug}`;
    return (
      hasPermissionNode(permissions, ticketNode) ||
      hasPermissionNode(permissions, "zander.web.tickets.*")
    );
  };

  const requireTicketPermission = async (req, res) =>
    await hasPermission("zander.web.tickets", req, res, features);

  const requireCategoryPermission = async (category, req, res) => {
    const slug = getCategorySlug(category);

    if (!userHasCategoryPermission(slug, req.session.user?.permissions)) {
      return res.view("session/noPermission", {
        pageTitle: "Access Restricted",
        config,
        req,
        res,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    return true;
  };

  const filterCategoriesByPermission = (categories, permissions) => {
    return categories
      .map((category) => ({ ...category, slug: getCategorySlug(category) }))
      .filter((category) =>
        userHasCategoryPermission(category.slug, permissions)
      );
  };

  app.get("/dashboard/support", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const categories = filterCategoriesByPermission(
        await getSupportCategories(),
        req.session.user.permissions
      );
      const permittedCategoryIds = categories.map(
        (category) => category.categoryId
      );

      const tickets = (await getAllTickets()).filter((ticket) =>
        permittedCategoryIds.includes(ticket.categoryId),
      );

      return res.view("modules/dashboard/support/index", {
        pageTitle: "Support Tickets",
        pageDescription: "Manage Support Tickets",
        config,
        req,
        features,
        tickets,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.get("/dashboard/support/explorer", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const { category } = req.query;
      let tickets = [];

      const permittedCategories = filterCategoriesByPermission(
        await getSupportCategories(),
        req.session.user.permissions
      );

      const selectedCategory = permittedCategories.find(
        (c) => String(c.categoryId) === category
      );

      if (category && !selectedCategory) {
        return res.view("session/noPermission", {
          pageTitle: "Access Restricted",
          config,
          req,
          res,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }

      if (selectedCategory) {
        tickets = await getTicketsByCategory(selectedCategory.categoryId);
      } else {
        const permittedCategoryIds = permittedCategories.map(
          (c) => c.categoryId
        );
        tickets = (await getAllTickets()).filter((ticket) =>
          permittedCategoryIds.includes(ticket.categoryId)
        );
      }

      return res.view("modules/dashboard/support/explorer", {
        pageTitle: "Support Ticket Explorer",
        pageDescription: "Support Ticket Explorer",
        config,
        req,
        features,
        tickets,
        categories: permittedCategories,
        selectedCategory: selectedCategory?.categoryId,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.get("/dashboard/support/categories", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const categories = await getSupportCategoriesWithPermissions();
      const roles = await getLuckPermRoles();

      const roleNameMap = new Map(
        roles.map((role) => [String(role.id), role.name])
      );

      const roleStyleMap = new Map(
        roles.map((role) => [String(role.id), role])
      );

      const categoriesWithRoleNames = categories.map((category) => {
        const permissionIds = category.permissions
          ? category.permissions.split(",").filter(Boolean)
          : [];

        const permissionIdSet = new Set(permissionIds.map((id) => String(id)));

        return {
          ...category,
          permissions: permissionIds.map((roleId) => {
            const roleMeta = roleStyleMap.get(String(roleId));
            return {
              roleId,
              roleName: roleMeta?.name || roleId,
              badgeColor: roleMeta?.rankBadgeColour,
              textColor: roleMeta?.rankTextColour,
            };
          }),
          availableRoles: roles.filter(
            (role) => !permissionIdSet.has(String(role.id))
          ),
        };
      });

      console.info(
        "Loaded support categories",
        categories?.length ?? 0,
        "and LuckPerms ranks with Discord roles",
        roles?.length ?? 0
      );

      return res.view("modules/dashboard/support/categories", {
        pageTitle: "Support Ticket Categories",
        pageDescription: "Support Ticket Categories",
        config,
        req,
        features,
        categories: categoriesWithRoleNames,
        roles,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Failed to render support categories dashboard", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.post(
    "/dashboard/support/categories/:id/permissions",
    async function (req, res) {
      try {
        const hasTicketsAccess = await requireTicketPermission(req, res);
        if (hasTicketsAccess !== true) return hasTicketsAccess;

        const { id } = req.params;
        const { roleId } = req.body;

        await addCategoryPermission(id, roleId);

        return res.redirect(getSafeRedirectTarget(req));
      } catch (error) {
        console.error(error);
        return res.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error",
          config,
          req,
          error,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }
    }
  );

  app.post(
    "/dashboard/support/categories/:id/permissions/:roleId/delete",
    async function (req, res) {
      try {
        const hasTicketsAccess = await requireTicketPermission(req, res);
        if (hasTicketsAccess !== true) return hasTicketsAccess;

        const { id, roleId } = req.params;

        await removeCategoryPermission(id, roleId);

        return res.redirect(getSafeRedirectTarget(req));
      } catch (error) {
        console.error(error);
        return res.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error",
          config,
          req,
          error,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }
    }
  );

  app.post("/dashboard/support/categories", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const { name, description, discordCategoryId } = req.body;
      await createSupportCategory(name, description, discordCategoryId);

      await updateSupportMessage(client);

      return res.redirect("/dashboard/support/categories");
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.get("/dashboard/support/categories/:id/edit", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const category = await getCategoryById(req.params.id);
      const roles = await getLuckPermRoles();
      const categoryPermissions =
        (await getCategoryPermissions(category.categoryId)) || [];

      const roleStyleMap = new Map(
        roles.map((role) => [String(role.id), role])
      );
      const permissionIdSet = new Set(
        categoryPermissions.map((roleId) => String(roleId))
      );

      const categoryWithPermissions = {
        ...category,
        permissions: categoryPermissions.map((roleId) => {
          const roleMeta = roleStyleMap.get(String(roleId));
          return {
            roleId,
            roleName: roleMeta?.name || roleId,
            badgeColor: roleMeta?.rankBadgeColour,
            textColor: roleMeta?.rankTextColour,
          };
        }),
        availableRoles: roles.filter(
          (role) => !permissionIdSet.has(String(role.id))
        ),
      };

      return res.view("modules/dashboard/support/edit-category", {
        pageTitle: "Edit Support Category",
        pageDescription: "Edit Support Category",
        config,
        req,
        features,
        category: categoryWithPermissions,
        roles,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.post("/dashboard/support/categories/:id/edit", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const { id } = req.params;
      const { name, description, discordCategoryId } = req.body;
      await updateSupportCategory(id, name, description, discordCategoryId);

      await updateSupportMessage(client);

      return res.redirect("/dashboard/support/categories");
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.post(
    "/dashboard/support/categories/:id/delete",
    async function (req, res) {
      try {
        const hasTicketsAccess = await requireTicketPermission(req, res);
        if (hasTicketsAccess !== true) return hasTicketsAccess;

        const { id } = req.params;
        await deleteSupportCategory(id);

        await updateSupportMessage(client);

        return res.redirect("/dashboard/support/categories");
      } catch (error) {
        console.error(error);
        return res.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error",
          config,
          req,
          error,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }
    }
  );

  app.post("/dashboard/support/ticket/:id/status", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const ticket = await getTicketById(req.params.id);
      const category = await getCategoryById(ticket.categoryId);
      const hasCategoryAccess = await requireCategoryPermission(
        category,
        req,
        res
      );
      if (hasCategoryAccess !== true) return hasCategoryAccess;

      const newStatus = req.body.status;
      await updateTicketStatus(ticket.ticketId, newStatus);
      await notifyTicketStatusChange(ticket.ticketId, newStatus, {
        userId: req.session.user.userId,
        name: req.session.user.username,
      });

      if (newStatus === "closed") {
        await deleteTicketChannel(client, ticket.ticketId, "Ticket closed from dashboard");
      } else if (newStatus === "open") {
        let needsChannel = !ticket.discordChannelId;

        if (!needsChannel && client) {
          try {
            await client.channels.fetch(ticket.discordChannelId);
          } catch (fetchError) {
            console.warn(
              "dashboard reopen: stored channel missing, recreating",
              fetchError
            );
            needsChannel = true;
          }
        }

        if (needsChannel) {
          try {
            await recreateTicketChannel(client, ticket.ticketId);
          } catch (recreateError) {
            console.error("Failed to recreate ticket channel on reopen", recreateError);
          }
        }
      }

      return res.redirect(`/support/ticket/${req.params.id}`);
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.post("/dashboard/support/message", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      await postSupportMessage(client);

      return res.redirect("/dashboard/support/categories");
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  async function getLuckPermRoles() {
    try {
      const ranks = await new Promise((resolve, reject) => {
        db.query(
          "SELECT rankSlug, displayName, discordRoleId, rankBadgeColour, rankTextColour FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''",
          (error, results) => {
            if (error) {
              reject(error);
            } else {
              resolve(results);
            }
          }
        );
      });

      return ranks.map((rank) => ({
        id: rank.discordRoleId,
        name: rank.displayName || rank.rankSlug,
        rankSlug: rank.rankSlug,
        rankBadgeColour: rank.rankBadgeColour,
        rankTextColour: rank.rankTextColour,
      }));
    } catch (error) {
      console.error(
        "getLuckPermRoles: failed to fetch rank Discord role mappings for support categories",
        error
      );
      return [];
    }
  }

  async function postSupportMessage(client) {
    if (!client) {
      console.warn(
        "postSupportMessage: Discord client unavailable; skipping support panel update"
      );
      return;
    }

    const supportChannelId =
      config.discord?.supportPanelChannelId || process.env.SUPPORT_CHANNEL_ID;

    if (!supportChannelId) {
      console.warn(
        "postSupportMessage: SUPPORT_CHANNEL_ID is not configured; skipping support panel update"
      );
      return;
    }

    let channel;
    try {
      channel = await client.channels.fetch(supportChannelId);
    } catch (error) {
      console.error(
        "postSupportMessage: failed to fetch support channel for ticket panel",
        error
      );
      return;
    }
    const categories = await getSupportCategories();

    const buttons = categories.map((category) =>
      new ButtonBuilder()
        .setCustomId(`support_category_${category.categoryId}`)
        .setLabel(category.name)
        .setStyle(ButtonStyle.Primary),
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    await channel.send({
      content: "Please select a category to create a support ticket:",
      components: [row],
    });
  }

  async function updateSupportMessage(client) {
    if (!client) {
      console.warn(
        "updateSupportMessage: Discord client unavailable; skipping support panel refresh"
      );
      return;
    }

    const supportChannelId =
      config.discord?.supportPanelChannelId || process.env.SUPPORT_CHANNEL_ID;

    if (!supportChannelId) {
      console.warn(
        "updateSupportMessage: SUPPORT_CHANNEL_ID is not configured; skipping support panel refresh"
      );
      return;
    }

    let channel;
    try {
      channel = await client.channels.fetch(supportChannelId);
    } catch (error) {
      console.error(
        "updateSupportMessage: failed to fetch support channel for ticket panel",
        error
      );
      return;
    }
    const messages = await channel.messages.fetch({ limit: 100 });
    const message = messages.find(
      (m) => m.author.id === client.user.id && m.components.length > 0
    );

    if (message) {
      const categories = await getSupportCategories();

      const buttons = categories.map((category) =>
        new ButtonBuilder()
          .setCustomId(`support_category_${category.categoryId}`)
          .setLabel(category.name)
          .setStyle(ButtonStyle.Primary),
      );

      const row = new ActionRowBuilder().addComponents(buttons);

      await message.edit({
        content: "Please select a category to create a support ticket:",
        components: [row],
      });
    }
  }
}
