import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../../api/common.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ImgurClient } from "imgur";
import {
  getSupportCategories,
  getSupportCategoriesWithPermissions,
  getCategoryName,
  addCategoryPermission,
  createSupportCategory,
  createSupportTicket,
  createSupportTicketMessage,
  deleteSupportCategory,
  getTicketsByUserId,
  getTicketById,
  getTicketMessages,
  getUserRoles,
  getCategoryPermissions,
  getAllTickets,
  updateTicketStatus,
} from "../../controllers/supportTicketController.js";

const imgurClient = new ImgurClient({
  clientId: process.env.IMGUR_CLIENT_ID,
  clientSecret: process.env.IMGUR_CLIENT_SECRET,
  refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

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
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    let tickets = [];
    if (req.session.user.isStaff) {
      tickets = await getAllTickets();
    } else {
      tickets = await getTicketsByUserId(req.session.user.userId);
    }

    return res.view("modules/dashboard/support/index", {
      pageTitle: "Support Tickets",
      config,
      req,
      features,
      tickets,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/support/ticket/:id", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    const ticket = await getTicketById(req.params.id);
    const messages = await getTicketMessages(req.params.id);

    const userRoles = await getUserRoles(req.session.user.userId);
    const categoryPermissions = await getCategoryPermissions(ticket.categoryId);

    if (ticket.userId !== req.session.user.userId && !hasPermission(userRoles, categoryPermissions)) {
      return res.redirect("/dashboard/support");
    }

    return res.view("modules/dashboard/support/ticket", {
      pageTitle: `Ticket #${ticket.ticketId}`,
      config,
      req,
      features,
      ticket,
      messages,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/dashboard/support/ticket/:id/status", async function (req, res) {
    if (!req.session.user || !req.session.user.isStaff) {
      return res.redirect("/session/login");
    }

    await updateTicketStatus(req.params.id, req.body.status);

    return res.redirect(`/dashboard/support/ticket/${req.params.id}`);
  });

  app.post("/dashboard/support/ticket/:id", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    const { message } = req.body;
    const attachment = req.raw.files ? req.raw.files.attachment : null;
    let attachmentUrl = null;

    if (attachment) {
      try {
        const response = await imgurClient.upload({
          image: attachment.data,
          type: "stream",
        });
        attachmentUrl = response.data.link;
      } catch (error) {
        console.error(error);
      }
    }

    await createSupportTicketMessage(
      client,
      req.params.id,
      req.session.user.userId,
      message,
      attachmentUrl
    );

    return res.redirect(`/dashboard/support/ticket/${req.params.id}`);
  });

  app.get("/dashboard/support/create", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    const categories = await getSupportCategories();

    return res.view("modules/dashboard/support/create", {
      pageTitle: "Create Support Ticket",
      config,
      req,
      features,
      categories,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/dashboard/support/create", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    const { title, category, message } = req.body;
    const attachment = req.raw.files ? req.raw.files.attachment : null;
    let attachmentUrl = null;

    if (attachment) {
      try {
        const response = await imgurClient.upload({
          image: attachment.data,
          type: "stream",
        });
        attachmentUrl = response.data.link;
      } catch (error) {
        console.error(error);
      }
    }

    const ticketId = await createSupportTicket(
      client,
      req.session.user.userId,
      category,
      title
    );
    await createSupportTicketMessage(
      client,
      ticketId,
      req.session.user.userId,
      message,
      attachmentUrl
    );

    const categoryName = await getCategoryName(category);
    await sendNewTicketNotification(
      client,
      ticketId,
      title,
      categoryName,
      req.session.user.username
    );

    return res.redirect("/dashboard/support");
  });

  app.get("/dashboard/support/categories", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    const categories = await getSupportCategoriesWithPermissions();
    const roles = await getDiscordRoles();

    return res.view("modules/dashboard/support/categories", {
      pageTitle: "Support Ticket Categories",
      config,
      req,
      features,
      categories,
      roles,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post(
    "/dashboard/support/categories/:id/permissions",
    async function (req, res) {
      if (!req.session.user) {
        return res.redirect("/session/login");
      }

      const { id } = req.params;
      const { roleId } = req.body;

      await addCategoryPermission(id, roleId);

      return res.redirect("/dashboard/support/categories");
    }
  );

  app.post("/dashboard/support/categories", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    const { name, description } = req.body;
    await createSupportCategory(name, description);

    await updateSupportMessage(client);

    return res.redirect("/dashboard/support/categories");
  });

  app.post(
    "/dashboard/support/categories/:id/delete",
    async function (req, res) {
      if (!req.session.user) {
        return res.redirect("/session/login");
      }

      const { id } = req.params;
      await deleteSupportCategory(id);

      await updateSupportMessage(client);

      return res.redirect("/dashboard/support/categories");
    }
  );

  app.post("/dashboard/support/message", async function (req, res) {
    if (!req.session.user) {
      return res.redirect("/session/login");
    }

    await postSupportMessage(client);

    return res.redirect("/dashboard/support/categories");
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

  async function sendNewTicketNotification(
    client,
    ticketId,
    title,
    categoryName,
    username
  ) {
    const channel = await client.channels.fetch(
      process.env.SUPPORT_NOTIFICATION_CHANNEL_ID
    );
    await channel.send(
      `A new support ticket has been created!\n\n**Ticket ID:** ${ticketId}\n**Title:** ${title}\n**Category:** ${categoryName}\n**User:** ${username}`
    );
  }

  function hasPermission(userRoles, categoryPermissions) {
    return userRoles.some(role => categoryPermissions.includes(role));
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
