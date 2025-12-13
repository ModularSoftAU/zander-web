import { getWebAnnouncement } from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common.js";
import { ImgurClient } from "imgur";
import {
  getSupportCategories,
  createSupportTicket,
  createSupportTicketMessage,
  getTicketsByUserId,
  getTicketById,
  getTicketMessages,
} from "../controllers/supportTicketController.js";

const imgurClient = new ImgurClient({
  clientId: process.env.IMGUR_CLIENT_ID,
  clientSecret: process.env.IMGUR_CLIENT_SECRET,
  refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

export default function supportRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  app.get("/support", async function (req, res) {
    try {
      if (!req.session.user) {
          return res.view("modules/support/login", {
              pageTitle: "Support Tickets",
              pageDescription: "Support Tickets",
              config,
              req,
              features,
              globalImage: await getGlobalImage(),
              announcementWeb: await getWebAnnouncement(),
          });
      }

      const tickets = await getTicketsByUserId(req.session.user.userId);

      return res.view("modules/support/index", {
        pageTitle: "Support Tickets",
        pageDescription: "Support Tickets",
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

  app.get("/support/ticket/:id", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
      }

      const ticket = await getTicketById(req.params.id);
      const messages = await getTicketMessages(req.params.id);

      const isOwner = ticket.userId === req.session.user.userId;
      const isStaff = req.session.user.isStaff;

      if (!isOwner && !isStaff) {
        return res.redirect("/support");
      }

      return res.view("modules/support/ticket", {
        pageTitle: `Ticket #${ticket.ticketId}`,
        pageDescription: `Ticket #${ticket.ticketId}`,
        config,
        req,
        features,
        ticket,
        messages,
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

  app.post("/support/ticket/:id", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
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

  app.get("/support/create", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
      }

      const categories = await getSupportCategories();

      return res.view("modules/support/create", {
        pageTitle: "Create Support Ticket",
        pageDescription: "Create Support Ticket",
        config,
        req,
        features,
        categories,
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

  app.post("/support/create", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
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

      return res.redirect("/support");
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
}
