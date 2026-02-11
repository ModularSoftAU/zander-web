import {
  isFeatureEnabled,
  required,
  optional,
  generateLog,
} from "../common.js";
import {
  getFormById,
  getFormBySlug,
  getAllForms,
  getPublishedForms,
  createForm,
  updateForm,
  updateFormStatus,
  deleteForm,
  getFormBlocks,
  replaceFormBlocks,
  getFormResponses,
  getFormResponseCount,
  getFormResponseById,
  createFormResponse,
  updateFormResponseStatus,
  validateFormSubmission,
  generateSlug,
  formatResponseForDisplay,
  formatResponseForDiscord,
  setResponseDiscordWebhookFailed,
  setResponseDiscordForumPostFailed,
  setResponseDiscordForumThreadId,
  setResponseConvertedToTicket,
} from "../../controllers/formController.js";

export default function formApiRoute(app, client, config, db, features, lang) {
  const baseEndpoint = "/api/forms";

  // ─── Get all forms (staff) ───
  app.get(baseEndpoint + "/get", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    try {
      const formId = optional(req.query, "id");
      const slug = optional(req.query, "slug");
      const publishedOnly = optional(req.query, "published");

      if (formId) {
        const form = await getFormById(formId);
        if (!form) {
          return res.send({ success: false, message: lang.forms.noFormsFound });
        }
        const blocks = await getFormBlocks(formId);
        return res.send({ success: true, data: { ...form, blocks } });
      }

      if (slug) {
        const form = await getFormBySlug(slug);
        if (!form) {
          return res.send({ success: false, message: lang.forms.noFormsFound });
        }
        const blocks = await getFormBlocks(form.formId);
        return res.send({ success: true, data: { ...form, blocks } });
      }

      const forms = publishedOnly ? await getPublishedForms() : await getAllForms();

      // Get response counts for each form
      const formsWithCounts = await Promise.all(
        forms.map(async (form) => {
          const counts = await getFormResponseCount(form.formId);
          return { ...form, responseCount: counts };
        })
      );

      return res.send({ success: true, data: formsWithCounts });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Create form ───
  app.post(baseEndpoint + "/create", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const name = required(req.body, "name", res);

    try {
      const slugInput = optional(req.body, "slug") || generateSlug(name);
      const status = optional(req.body, "status") || "draft";
      const discordWebhookUrl = optional(req.body, "discordWebhookUrl");
      const discordForumChannelId = optional(req.body, "discordForumChannelId");
      const postToForumEnabled = optional(req.body, "postToForumEnabled") || false;
      const webhookEnabled = optional(req.body, "webhookEnabled") || false;
      const submitterCanView = optional(req.body, "submitterCanView") !== false;
      const requireLogin = optional(req.body, "requireLogin") !== false;
      const blocks = optional(req.body, "blocks") || [];

      // Check slug uniqueness
      const existing = await getFormBySlug(slugInput);
      if (existing) {
        return res.send({ success: false, message: "A form with this slug already exists." });
      }

      const result = await createForm({
        name,
        slug: slugInput,
        status,
        createdByUserId: actioningUser,
        discordWebhookUrl,
        discordForumChannelId,
        postToForumEnabled,
        webhookEnabled,
        submitterCanView,
        requireLogin,
      });

      const formId = result.insertId;

      // Save blocks if provided
      if (blocks.length > 0) {
        await replaceFormBlocks(formId, blocks);
      }

      generateLog(actioningUser, "SUCCESS", "FORM", `Created form "${name}"`, res);

      return res.send({
        success: true,
        message: lang.forms.formCreated,
        data: { formId },
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Update form ───
  app.post(baseEndpoint + "/edit", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const formId = required(req.body, "formId", res);
    const name = required(req.body, "name", res);

    try {
      const slugInput = optional(req.body, "slug") || generateSlug(name);
      const status = optional(req.body, "status") || "draft";
      const discordWebhookUrl = optional(req.body, "discordWebhookUrl");
      const discordForumChannelId = optional(req.body, "discordForumChannelId");
      const postToForumEnabled = optional(req.body, "postToForumEnabled") || false;
      const webhookEnabled = optional(req.body, "webhookEnabled") || false;
      const submitterCanView = optional(req.body, "submitterCanView") !== false;
      const requireLogin = optional(req.body, "requireLogin") !== false;
      const blocks = optional(req.body, "blocks");

      // Check slug uniqueness (excluding current form)
      const existing = await getFormBySlug(slugInput);
      if (existing && existing.formId !== parseInt(formId)) {
        return res.send({ success: false, message: "A form with this slug already exists." });
      }

      await updateForm(formId, {
        name,
        slug: slugInput,
        status,
        discordWebhookUrl,
        discordForumChannelId,
        postToForumEnabled,
        webhookEnabled,
        submitterCanView,
        requireLogin,
      });

      // Replace blocks if provided
      if (blocks !== null && Array.isArray(blocks)) {
        await replaceFormBlocks(formId, blocks);
      }

      generateLog(actioningUser, "SUCCESS", "FORM", `Edited form "${name}"`, res);

      return res.send({
        success: true,
        message: lang.forms.formEdited,
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Delete form ───
  app.post(baseEndpoint + "/delete", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const formId = required(req.body, "formId", res);

    try {
      await deleteForm(formId);

      generateLog(actioningUser, "WARNING", "FORM", `Deleted form ${formId}`, res);

      return res.send({
        success: true,
        message: lang.forms.formDeleted,
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Publish / unpublish form ───
  app.post(baseEndpoint + "/publish", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const formId = required(req.body, "formId", res);
    const status = required(req.body, "status", res);

    try {
      await updateFormStatus(formId, status);

      generateLog(actioningUser, "SUCCESS", "FORM", `Set form ${formId} status to ${status}`, res);

      return res.send({
        success: true,
        message: `Form status updated to ${status}.`,
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Submit form response ───
  app.post(baseEndpoint + "/submit", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const formId = required(req.body, "formId", res);
    const answers = required(req.body, "answers", res);
    const submittedByUserId = optional(req.body, "submittedByUserId");

    try {
      const form = await getFormById(formId);
      if (!form) {
        return res.send({ success: false, message: "Form not found." });
      }
      if (form.status !== "published") {
        return res.send({ success: false, message: "This form is not currently accepting responses." });
      }
      if (form.requireLogin && !submittedByUserId) {
        return res.send({ success: false, message: "You must be logged in to submit this form." });
      }

      // Validate answers against blocks
      const blocks = await getFormBlocks(formId);
      const validationErrors = validateFormSubmission(blocks, answers);
      if (validationErrors.length > 0) {
        return res.send({
          success: false,
          message: "Validation failed.",
          errors: validationErrors,
        });
      }

      const result = await createFormResponse(formId, submittedByUserId, answers);
      const responseId = result.insertId;

      // Discord delivery (async, non-blocking — submission succeeds regardless)
      deliverToDiscord(form, blocks, answers, responseId, submittedByUserId, client).catch((err) => {
        console.error("[Forms] Discord delivery error:", err);
      });

      return res.send({
        success: true,
        message: lang.forms.formSubmitted,
        data: { responseId },
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Get responses for a form (staff) ───
  app.get(baseEndpoint + "/responses", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const formId = required(req.query, "formId", res);

    try {
      const status = optional(req.query, "status");
      const page = parseInt(optional(req.query, "page") || "1");
      const limit = parseInt(optional(req.query, "limit") || "25");

      const responses = await getFormResponses(formId, { status, page, limit });
      const counts = await getFormResponseCount(formId);

      return res.send({
        success: true,
        data: responses,
        meta: counts,
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Get single response ───
  app.get(baseEndpoint + "/response", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const responseId = required(req.query, "responseId", res);

    try {
      const response = await getFormResponseById(responseId);
      if (!response) {
        return res.send({ success: false, message: "Response not found." });
      }

      const form = await getFormById(response.formId);
      const blocks = await getFormBlocks(response.formId);

      return res.send({
        success: true,
        data: {
          response,
          form,
          blocks,
        },
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  // ─── Update response status ───
  app.post(baseEndpoint + "/response/status", async function (req, res) {
    isFeatureEnabled(features.forms, res, lang);

    const actioningUser = required(req.body, "actioningUser", res);
    const responseId = required(req.body, "responseId", res);
    const status = required(req.body, "status", res);

    try {
      await updateFormResponseStatus(responseId, status);

      generateLog(actioningUser, "SUCCESS", "FORM", `Updated response ${responseId} status to ${status}`, res);

      return res.send({
        success: true,
        message: `Response status updated to ${status}.`,
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });
}

// ─── Discord Delivery ───

async function deliverToDiscord(form, blocks, answers, responseId, submittedByUserId, client) {
  const viewUrl = `${process.env.siteAddress}/dashboard/forms/${form.formId}/responses/${responseId}`;

  // Webhook embed notification
  if (form.webhookEnabled && form.discordWebhookUrl) {
    try {
      const { Webhook, MessageBuilder } = await import("discord-webhook-node");
      const hook = new Webhook(form.discordWebhookUrl);
      hook.setThrowErrors(false);

      const embed = new MessageBuilder()
        .setTitle("New Form Submission")
        .setColor("#4e73df")
        .addField("Form", form.name, true)
        .addField("Submission ID", `#${responseId}`, true)
        .addField("Submitter", submittedByUserId ? `User ${submittedByUserId}` : "Anonymous", true)
        .addField("View Online", viewUrl)
        .setTimestamp();

      await hook.send(embed);
    } catch (err) {
      console.error("[Forms] Webhook delivery failed:", err);
      await setResponseDiscordWebhookFailed(responseId);
    }
  }

  // Forum post via bot
  if (form.postToForumEnabled && form.discordForumChannelId && client) {
    try {
      const channel = await client.channels.fetch(form.discordForumChannelId);
      if (channel && channel.threads) {
        const content = formatResponseForDiscord(blocks, answers, 1900);
        const threadTitle = `${form.name} — Submission #${responseId}`;

        const thread = await channel.threads.create({
          name: threadTitle.substring(0, 100),
          message: {
            content: `${content}\n\n**[View Online](${viewUrl})**`,
          },
        });

        await setResponseDiscordForumThreadId(responseId, thread.id);
      }
    } catch (err) {
      console.error("[Forms] Forum post delivery failed:", err);
      await setResponseDiscordForumPostFailed(responseId);
    }
  }
}
