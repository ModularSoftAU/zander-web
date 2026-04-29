import {
  hasPermission,
  isFeatureWebRouteEnabled,
  setBannerCookie,
} from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import {
  getFormById,
  getAllForms,
  getFormBlocks,
  getFormResponses,
  getFormResponseCount,
  getFormResponseById,
  formatResponseForDisplay,
  setResponseConvertedToTicket,
} from "../../controllers/formController.js";
import {
  createSupportTicket,
  createSupportTicketMessage,
  ensureUncategorisedCategory,
  syncParticipantsForMessage,
  addTicketUserParticipant,
  applyTicketParticipantPermissions,
} from "../../controllers/supportTicketController.js";
import { hasPermission as hasPermissionNode } from "../../lib/discord/permissions.mjs";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export default function dashboardFormsSiteRoute(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  // ─── Per-form permission helpers ───
  const userHasFormPermission = (slug, permissions = []) => {
    if (!slug) return false;
    const formNode = `zander.web.forms.${slug}`;
    return (
      hasPermissionNode(permissions, formNode) ||
      hasPermissionNode(permissions, "zander.web.forms.*")
    );
  };

  const requireFormPermission = (form, req, res) => {
    if (!userHasFormPermission(form.slug, req.session.user?.permissions)) {
      setBannerCookie("danger", "You do not have permission to manage this form.", res);
      res.redirect("/dashboard/forms");
      return false;
    }
    return true;
  };

  const filterFormsByPermission = (forms, permissions) => {
    return forms.filter((form) =>
      userHasFormPermission(form.slug, permissions)
    );
  };

  // ─── Forms list ───
  app.get("/dashboard/forms", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.forms, req, res, features)) return;
    if (!await hasPermission("zander.web.forms", req, res, features)) return;

    try {
      let allForms = [];
      try {
        allForms = await getAllForms();
      } catch (dbError) {
        if (dbError.code === 'ER_NO_SUCH_TABLE') {
          res.header("content-type", "text/html; charset=utf-8").send(
            await app.view("dashboard/forms/form-list", {
              pageTitle: "Dashboard - Forms",
              config,
              forms: [],
              features,
              req,
              migrationNeeded: true,
              ...adminViewData(req, features),
            })
          );
          return;
        }
        throw dbError;
      }

      const forms = filterFormsByPermission(
        allForms,
        req.session.user.permissions
      );

      const formsWithCounts = await Promise.all(
        forms.map(async (form) => {
          const counts = await getFormResponseCount(form.formId);
          return { ...form, responseCount: counts };
        })
      );

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/forms/form-list", {
          pageTitle: "Dashboard - Forms",
          config,
          forms: formsWithCounts,
          features,
          req,
          ...adminViewData(req, features),
        })
      );
    } catch (error) {
      console.error("Error loading forms list:", error);
      setBannerCookie("danger", "Error loading forms.", res);
      return res.redirect("/dashboard");
    }
  });

  // ─── Create form page ───
  app.get("/dashboard/forms/create", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.forms, req, res, features)) return;
    if (!await hasPermission("zander.web.forms", req, res, features)) return;

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/forms/form-editor", {
        pageTitle: "Dashboard - Create Form",
        config,
        type: "create",
        form: null,
        blocks: [],
        features,
        req,
        ...adminViewData(req, features),
      })
    );
  });

  // ─── Edit form page ───
  app.get("/dashboard/forms/edit", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.forms, req, res, features)) return;
    if (!await hasPermission("zander.web.forms", req, res, features)) return;

    const formId = req.query.formId;
    if (!formId) {
      setBannerCookie("danger", "No form ID specified.", res);
      return res.redirect("/dashboard/forms");
    }

    try {
      const form = await getFormById(formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      if (!requireFormPermission(form, req, res)) return;

      const blocks = await getFormBlocks(formId);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/forms/form-editor", {
          pageTitle: "Dashboard - Edit Form",
          config,
          type: "edit",
          form,
          blocks,
          features,
          req,
          ...adminViewData(req, features),
        })
      );
    } catch (error) {
      console.error("Error loading form editor:", error);
      setBannerCookie("danger", "Error loading form.", res);
      return res.redirect("/dashboard/forms");
    }
  });

  // ─── Responses inbox for a form ───
  app.get("/dashboard/forms/:formId/responses", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.forms, req, res, features)) return;
    if (!await hasPermission("zander.web.forms", req, res, features)) return;

    const formId = req.params.formId;

    try {
      const form = await getFormById(formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      if (!requireFormPermission(form, req, res)) return;

      const statusFilter = req.query.status || null;
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = 25;

      const responses = await getFormResponses(formId, {
        status: statusFilter,
        page,
        limit,
      });
      const counts = await getFormResponseCount(formId);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/forms/response-list", {
          pageTitle: `Dashboard - ${form.name} Responses`,
          config,
          form,
          responses,
          counts,
          statusFilter,
          page,
          limit,
          moment,
          features,
          req,
          ...adminViewData(req, features),
        })
      );
    } catch (error) {
      console.error("Error loading responses:", error);
      setBannerCookie("danger", "Error loading responses.", res);
      return res.redirect("/dashboard/forms");
    }
  });

  // ─── View single response ───
  app.get("/dashboard/forms/:formId/responses/:responseId", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.forms, req, res, features)) return;
    if (!await hasPermission("zander.web.forms", req, res, features)) return;

    try {
      const form = await getFormById(req.params.formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      if (!requireFormPermission(form, req, res)) return;

      const response = await getFormResponseById(req.params.responseId);
      if (!response || response.formId !== parseInt(form.formId)) {
        setBannerCookie("danger", "Response not found.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses`);
      }

      const blocks = await getFormBlocks(form.formId);
      const formattedAnswers = formatResponseForDisplay(blocks, response.answers);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/forms/response-detail", {
          pageTitle: `Dashboard - Response #${response.responseId}`,
          config,
          form,
          response,
          blocks,
          formattedAnswers,
          moment,
          features,
          req,
          ...adminViewData(req, features),
        })
      );
    } catch (error) {
      console.error("Error loading response detail:", error);
      setBannerCookie("danger", "Error loading response.", res);
      return res.redirect("/dashboard/forms");
    }
  });

  // ─── Convert response to ticket ───
  app.post("/dashboard/forms/:formId/responses/:responseId/convert-to-ticket", async function (req, res) {
    if (!await isFeatureWebRouteEnabled(app, features.forms, req, res, features)) return;
    if (!await hasPermission("zander.web.forms", req, res, features)) return;

    try {
      const form = await getFormById(req.params.formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      if (!requireFormPermission(form, req, res)) return;

      const response = await getFormResponseById(req.params.responseId);
      if (!response || response.formId !== parseInt(form.formId)) {
        setBannerCookie("danger", "Response not found.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses`);
      }

      if (response.status === "converted" && response.ticketId) {
        setBannerCookie("warning", "This response has already been converted to a ticket.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses/${response.responseId}`);
      }

      if (!response.submittedByUserId) {
        setBannerCookie("danger", "Anonymous responses cannot be converted to tickets.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses/${response.responseId}`);
      }

      const categoryId = await ensureUncategorisedCategory();
      const ticketTitle = `Form Submission: ${form.name}`;
      const ticketUserId = response.submittedByUserId;
      const submitterDiscordId = response.submitterDiscordId || null;

      const blocks = await getFormBlocks(form.formId);
      const formattedAnswers = formatResponseForDisplay(blocks, response.answers);
      let ticketBody = `**Converted from Form Response #${response.responseId}**\n`;
      ticketBody += `**Form:** ${form.name}\n`;
      ticketBody += `**Submitted by:** ${response.submitterUsername || "Unknown"}\n`;
      ticketBody += `**Submitted at:** ${response.submittedAt}\n\n`;
      ticketBody += `---\n\n`;
      for (const answer of formattedAnswers) {
        ticketBody += `**${answer.label}**\n${answer.value}\n\n`;
      }

      const ticketRecord = await createSupportTicket(
        client,
        ticketUserId,
        categoryId,
        ticketTitle,
        {
          discordUserId: submitterDiscordId,
          staffRoleIds: [],
        }
      );

      const { ticketId, channel } = ticketRecord;

      // Initial message (same pattern as normal ticket creation)
      await createSupportTicketMessage(
        client,
        ticketId,
        ticketUserId,
        ticketBody,
        "web",
        { skipDiscordPost: true }
      );

      // Add submitter as participant
      await syncParticipantsForMessage(client, ticketId, {
        userId: ticketUserId,
        rankSlugs: [],
      });

      // Add the converting staff member as participant
      try {
        await addTicketUserParticipant(ticketId, { userId: req.session.user.userId });
        await applyTicketParticipantPermissions(client, ticketId);
      } catch (participantError) {
        console.error("Failed to add staff participant to converted ticket", participantError);
      }

      // Post the Discord channel embed (mirrors normal ticket creation)
      if (channel) {
        const siteBaseUrl =
          (config.siteConfiguration && config.siteConfiguration.siteUrl) ||
          process.env.SITE_URL ||
          process.env.siteAddress ||
          "";
        const normalizedSiteUrl = siteBaseUrl.endsWith("/")
          ? siteBaseUrl.slice(0, -1)
          : siteBaseUrl;
        const ticketUrl = `${normalizedSiteUrl}/support/ticket/${ticketId}`;

        const ticketEmbed = new EmbedBuilder()
          .setTitle(`Ticket #${ticketId}: ${ticketTitle}`)
          .setDescription(ticketBody.length > 4000 ? ticketBody.substring(0, 4000) + "..." : ticketBody)
          .addFields(
            { name: "Submitted by", value: response.submitterUsername || "Unknown" },
            { name: "Converted by", value: req.session.user.username || "Staff" },
            { name: "Category", value: "Uncategorised" }
          )
          .setTimestamp(new Date())
          .setColor(0x2b6cb0);

        const closeButton = new ButtonBuilder()
          .setCustomId("support_ticket_close")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger);

        const viewOnlineButton = new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("View Ticket Online")
          .setURL(ticketUrl);

        try {
          const createdMessage = await channel.send({
            content: submitterDiscordId
              ? `<@${submitterDiscordId}> a ticket has been created from your form submission.`
              : "A ticket has been created from a form submission.",
            embeds: [ticketEmbed],
            components: [new ActionRowBuilder().addComponents(viewOnlineButton, closeButton)],
          });

          try {
            await createdMessage.pin();
          } catch (pinError) {
            console.error("Failed to pin converted ticket opener message", pinError);
          }
        } catch (channelError) {
          console.error("Failed to send ticket embed for converted form response", channelError);
        }
      }

      // Status message noting the conversion
      await createSupportTicketMessage(
        client,
        ticketId,
        req.session.user.userId,
        `Converted by ${req.session.user.username} from a form response submitted by ${response.submitterUsername || "Unknown"}.`,
        "web",
        { messageType: "status" }
      );

      await setResponseConvertedToTicket(response.responseId, ticketId, req.session.user.userId);

      setBannerCookie("success", `Response converted to Ticket #${ticketId}.`, res);
      return res.redirect(`/support/ticket/${ticketId}`);
    } catch (error) {
      console.error("Error converting response to ticket:", error);
      setBannerCookie("danger", "Error converting response to ticket.", res);
      return res.redirect(`/dashboard/forms/${req.params.formId}/responses/${req.params.responseId}`);
    }
  });
}
