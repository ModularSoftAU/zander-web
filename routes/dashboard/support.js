import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../../api/common.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  getSupportCategories,
  getSupportCategoriesWithPermissions,
  addCategoryPermission,
  createSupportCategory,
  deleteSupportCategory,
  getAllTickets,
  getTicketsByCategory,
  updateTicketStatus,
  getCategoryById,
  updateSupportCategory,
} from "../../controllers/supportTicketController.js";

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
  app.get("/dashboard/support", async function (req, res) {
    try {
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

      const tickets = await getAllTickets();

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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

      const { category } = req.query;
      let tickets = [];

      if (category) {
        tickets = await getTicketsByCategory(category);
      } else {
        tickets = await getAllTickets();
      }

      const categories = await getSupportCategories();

      return res.view("modules/dashboard/support/explorer", {
        pageTitle: "Support Ticket Explorer",
        pageDescription: "Support Ticket Explorer",
        config,
        req,
        features,
        tickets,
        categories,
        selectedCategory: category,
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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

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
        if (!req.session.user || !req.session.user.isStaff) {
          return res.redirect("/login");
        }

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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

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
        if (!req.session.user || !req.session.user.isStaff) {
          return res.redirect("/login");
        }

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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

      await updateTicketStatus(req.params.id, req.body.status);

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
      if (!req.session.user || !req.session.user.isStaff) {
        return res.redirect("/login");
      }

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
