import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
  setBannerCookie,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
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
} from "../../controllers/supportTicketController.js";

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
  const parseApiResponse = async (response) => {
    try {
      const text = await response.text();
      if (!text) {
        return { success: false, message: "Empty response from API." };
      }
      return JSON.parse(text);
    } catch (error) {
      return { success: false, message: "Invalid response from API." };
    }
  };

  // ─── Forms list ───
  app.get("/dashboard/forms", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;
    if (!(await hasPermission("zander.web.forms", req, res, features))) return;

    try {
      const forms = await getAllForms();

      // Get response counts for each form
      const formsWithCounts = await Promise.all(
        forms.map(async (form) => {
          const counts = await getFormResponseCount(form.formId);
          return { ...form, responseCount: counts };
        })
      );

      return res.view("dashboard/forms/form-list", {
        pageTitle: "Dashboard - Forms",
        config,
        forms: formsWithCounts,
        features,
        req,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error loading forms list:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading forms",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // ─── Create form page ───
  app.get("/dashboard/forms/create", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;
    if (!(await hasPermission("zander.web.forms", req, res, features))) return;

    return res.view("dashboard/forms/form-editor", {
      pageTitle: "Dashboard - Create Form",
      config,
      type: "create",
      form: null,
      blocks: [],
      features,
      req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  // ─── Edit form page ───
  app.get("/dashboard/forms/edit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;
    if (!(await hasPermission("zander.web.forms", req, res, features))) return;

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

      const blocks = await getFormBlocks(formId);

      return res.view("dashboard/forms/form-editor", {
        pageTitle: "Dashboard - Edit Form",
        config,
        type: "edit",
        form,
        blocks,
        features,
        req,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error loading form editor:", error);
      setBannerCookie("danger", "Error loading form.", res);
      return res.redirect("/dashboard/forms");
    }
  });

  // ─── Responses inbox for a form ───
  app.get("/dashboard/forms/:formId/responses", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;
    if (!(await hasPermission("zander.web.forms", req, res, features))) return;

    const formId = req.params.formId;

    try {
      const form = await getFormById(formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      const statusFilter = req.query.status || null;
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = 25;

      const responses = await getFormResponses(formId, {
        status: statusFilter,
        page,
        limit,
      });
      const counts = await getFormResponseCount(formId);

      return res.view("dashboard/forms/response-list", {
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
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error loading responses:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading responses",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // ─── View single response ───
  app.get("/dashboard/forms/:formId/responses/:responseId", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;
    if (!(await hasPermission("zander.web.forms", req, res, features))) return;

    try {
      const form = await getFormById(req.params.formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      const response = await getFormResponseById(req.params.responseId);
      if (!response || response.formId !== parseInt(form.formId)) {
        setBannerCookie("danger", "Response not found.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses`);
      }

      const blocks = await getFormBlocks(form.formId);
      const formattedAnswers = formatResponseForDisplay(blocks, response.answers);

      return res.view("dashboard/forms/response-detail", {
        pageTitle: `Dashboard - Response #${response.responseId}`,
        config,
        form,
        response,
        blocks,
        formattedAnswers,
        moment,
        features,
        req,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error loading response detail:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading response",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // ─── Convert response to ticket ───
  app.post("/dashboard/forms/:formId/responses/:responseId/convert-to-ticket", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;
    if (!(await hasPermission("zander.web.forms", req, res, features))) return;

    try {
      const form = await getFormById(req.params.formId);
      if (!form) {
        setBannerCookie("danger", "Form not found.", res);
        return res.redirect("/dashboard/forms");
      }

      const response = await getFormResponseById(req.params.responseId);
      if (!response || response.formId !== parseInt(form.formId)) {
        setBannerCookie("danger", "Response not found.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses`);
      }

      if (response.status === "converted" && response.ticketId) {
        setBannerCookie("warning", "This response has already been converted to a ticket.", res);
        return res.redirect(`/dashboard/forms/${form.formId}/responses/${response.responseId}`);
      }

      // Get or create a category for form-converted tickets
      const categoryId = await ensureUncategorisedCategory();

      const ticketTitle = `Form Submission: ${form.name}`;
      const ticketUserId = response.submittedByUserId || req.session.user.userId;

      // Build ticket body from formatted answers
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

      // Create ticket
      const ticket = await createSupportTicket(
        client,
        ticketUserId,
        categoryId,
        ticketTitle,
        {
          discordUserId: req.session.user.discordId || null,
          staffRoleIds: [],
        }
      );

      const ticketId = ticket.ticketId;

      // Add the form content as the first message
      await createSupportTicketMessage(
        client,
        ticketId,
        ticketUserId,
        ticketBody,
        "web"
      );

      // Add conversion note
      await createSupportTicketMessage(
        client,
        ticketId,
        req.session.user.userId,
        `Converted by ${req.session.user.username} from a form response submitted by ${response.submitterUsername || "Unknown"}.`,
        "web"
      );

      // Update response status
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
