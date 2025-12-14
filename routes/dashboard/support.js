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
  createSupportCategory,
  deleteSupportCategory,
  getAllTickets,
  getTicketById,
  getTicketsByCategory,
  updateTicketStatus,
  getCategoryById,
  updateSupportCategory,
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
  lang
) {
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
        permittedCategoryIds.includes(ticket.categoryId)
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
      });
    }
  });

  app.get("/dashboard/support/categories", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const categories = await getSupportCategoriesWithPermissions();
      const roles = await getDiscordRoles();

      return res.view("modules/dashboard/support/categories", {
        pageTitle: "Support Ticket Categories",
        pageDescription: "Support Ticket Categories",
        config,
        req,
        features,
        categories,
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

        return res.redirect("/dashboard/support/categories");
      } catch (error) {
        console.error(error);
        return res.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error",
          config,
          req,
          error,
        });
      }
    }
  );

  app.post("/dashboard/support/categories", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const { name, description } = req.body;
      await createSupportCategory(name, description);

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
      });
    }
  });

  app.get("/dashboard/support/categories/:id/edit", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const category = await getCategoryById(req.params.id);

      return res.view("modules/dashboard/support/edit-category", {
        pageTitle: "Edit Support Category",
        pageDescription: "Edit Support Category",
        config,
        req,
        features,
        category,
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
      });
    }
  });

  app.post("/dashboard/support/categories/:id/edit", async function (req, res) {
    try {
      const hasTicketsAccess = await requireTicketPermission(req, res);
      if (hasTicketsAccess !== true) return hasTicketsAccess;

      const { id } = req.params;
      const { name, description } = req.body;
      await updateSupportCategory(id, name, description);

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

      await updateTicketStatus(ticket.ticketId, req.body.status);

      return res.redirect(`/support/ticket/${req.params.id}`);
    } catch (error) {
      console.error(error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error",
        config,
        req,
        error,
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
      });
    }
  });

  async function getDiscordRoles() {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const roles = await guild.roles.fetch();
    return roles.map((role) => ({ id: role.id, name: role.name }));
  }

  async function postSupportMessage(client) {
    const channel = await client.channels.fetch(process.env.SUPPORT_CHANNEL_ID);
    const categories = await getSupportCategories();

    const buttons = categories.map((category) =>
      new ButtonBuilder()
        .setCustomId(`support_category_${category.categoryId}`)
        .setLabel(category.name)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    await channel.send({
      content: "Please select a category to create a support ticket:",
      components: [row],
    });
  }

  async function updateSupportMessage(client) {
    const channel = await client.channels.fetch(process.env.SUPPORT_CHANNEL_ID);
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
          .setStyle(ButtonStyle.Primary)
      );

      const row = new ActionRowBuilder().addComponents(buttons);

      await message.edit({
        content: "Please select a category to create a support ticket:",
        components: [row],
      });
    }
  }
}
