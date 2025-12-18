import { getWebAnnouncement } from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage, setBannerCookie } from "../api/common.js";
import {
  getSupportCategories,
  createSupportTicket,
  createSupportTicketMessage,
  getTicketsByUserId,
  getTicketById,
  getTicketMessages,
  getTicketParticipants,
  getLuckPermRankRoles,
  findUserByIdentifier,
  addTicketUserParticipant,
  addTicketGroupParticipant,
  applyTicketParticipantPermissions,
  syncParticipantsForMessage,
} from "../controllers/supportTicketController.js";

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
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
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
      const participants = await getTicketParticipants(req.params.id);
      const rankOptions = await getLuckPermRankRoles();

      const isOwner = ticket.userId === req.session.user.userId;
      const isStaff = req.session.user.isStaff;
      const userRankSlugs = req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
      const isParticipantUser = participants.users.some(
        (participant) => participant.userId === req.session.user.userId
      );
      const isParticipantRank = userRankSlugs.some((slug) =>
        participants.groups.some((group) => group.rankSlug === slug)
      );

      if (!isOwner && !isStaff && !isParticipantUser && !isParticipantRank) {
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
        participants,
        rankOptions,
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

  app.post("/support/ticket/:id", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
      }

      const ticket = await getTicketById(req.params.id);
      const participants = await getTicketParticipants(req.params.id);
      const userRankSlugs = req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
      const isOwner = ticket.userId === req.session.user.userId;
      const isStaff = req.session.user.isStaff;
      const isParticipantUser = participants.users.some(
        (participant) => participant.userId === req.session.user.userId
      );
      const isParticipantRank = userRankSlugs.some((slug) =>
        participants.groups.some((group) => group.rankSlug === slug)
      );

      if (!isOwner && !isStaff && !isParticipantUser && !isParticipantRank) {
        return res.redirect("/support");
      }

      const body = req.body || {};
      const message = (body.message || "").trim();
      if (!message) {
        setBannerCookie("warning", "Please enter a message before replying.", res);
        return res.redirect(`/support/ticket/${req.params.id}`);
      }

      console.info("Submitting web ticket reply", {
        ticketId: req.params.id,
        userId: req.session.user.userId,
        messageLength: message.length,
      });

      let messageId;
      try {
        messageId = await createSupportTicketMessage(
          client,
          req.params.id,
          req.session.user.userId,
          message
        );
      } catch (createError) {
        console.error("Failed to create support ticket message", {
          ticketId: req.params.id,
          userId: req.session.user.userId,
        }, createError);
        setBannerCookie("danger", "Unable to submit your reply right now. Please try again.", res);
        return res.redirect(`/support/ticket/${req.params.id}`);
      }

      console.info("Web ticket reply persisted", {
        ticketId: req.params.id,
        userId: req.session.user.userId,
        messageId,
      });

      await syncParticipantsForMessage(client, ticket.ticketId, {
        userId: req.session.user.userId,
        rankSlugs: userRankSlugs,
      });

      console.info("Completed web ticket reply", {
        ticketId: req.params.id,
        userId: req.session.user.userId,
      });

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

  app.post("/support/ticket/:id/add-user", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
      }

      const ticket = await getTicketById(req.params.id);
      const participants = await getTicketParticipants(req.params.id);
      const userRankSlugs = req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
      const isOwner = ticket.userId === req.session.user.userId;
      const isStaff = req.session.user.isStaff;
      const isParticipantUser = participants.users.some(
        (participant) => participant.userId === req.session.user.userId
      );
      const isParticipantRank = userRankSlugs.some((slug) =>
        participants.groups.some((group) => group.rankSlug === slug)
      );

      if (!isOwner && !isStaff && !isParticipantUser && !isParticipantRank) {
        return res.redirect("/support");
      }

      const userIdentifier = (req.body?.userIdentifier || "").trim();
      if (!userIdentifier) {
        setBannerCookie("warning", "Provide a username or user ID to add.", res);
        return res.redirect(`/support/ticket/${req.params.id}`);
      }

      const user = await findUserByIdentifier(userIdentifier);
      if (!user) {
        setBannerCookie("danger", "User not found.", res);
        return res.redirect(`/support/ticket/${req.params.id}`);
      }

      await addTicketUserParticipant(ticket.ticketId, user);
      await applyTicketParticipantPermissions(client, ticket.ticketId);

      setBannerCookie("success", "User added to ticket.", res);
      return res.redirect(`/support/ticket/${ticket.ticketId}`);
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

  app.post("/support/ticket/:id/add-group", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
      }

      const ticket = await getTicketById(req.params.id);
      const participants = await getTicketParticipants(req.params.id);
      const userRankSlugs = req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
      const isOwner = ticket.userId === req.session.user.userId;
      const isStaff = req.session.user.isStaff;
      const isParticipantUser = participants.users.some(
        (participant) => participant.userId === req.session.user.userId
      );
      const isParticipantRank = userRankSlugs.some((slug) =>
        participants.groups.some((group) => group.rankSlug === slug)
      );

      if (!isOwner && !isStaff && !isParticipantUser && !isParticipantRank) {
        return res.redirect("/support");
      }

      const rankOptions = await getLuckPermRankRoles();
      const selectedRoleId = req.body?.groupRoleId;
      const selectedRank = rankOptions.find((rank) => rank.id === selectedRoleId && /^\d{5,}$/.test(rank.id));

      if (!selectedRank) {
        setBannerCookie("warning", "Select a valid group to add.", res);
        return res.redirect(`/support/ticket/${req.params.id}`);
      }

      await addTicketGroupParticipant(ticket.ticketId, selectedRank);
      await applyTicketParticipantPermissions(client, ticket.ticketId);

      setBannerCookie("success", "Group added to ticket.", res);
      return res.redirect(`/support/ticket/${ticket.ticketId}`);
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
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  app.post("/support/create", async function (req, res) {
    try {
      if (!req.session.user) {
        return res.redirect("/login");
      }

      const { title, category, message } = req.body;

      const { ticketId } = await createSupportTicket(
        client,
        req.session.user.userId,
        category,
        title,
        {
          discordUserId: req.session.user.discordId,
        }
      );
      await createSupportTicketMessage(
        client,
        ticketId,
        req.session.user.userId,
        message
      );

      await syncParticipantsForMessage(client, ticketId, {
        userId: req.session.user.userId,
        rankSlugs: req.session.user.ranks?.map((rank) => rank.rankSlug) || [],
      });

      return res.redirect("/support");
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
}
