import {
  getGlobalImage,
  isFeatureWebRouteEnabled,
  setBannerCookie,
} from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import {
  getFormBySlug,
  getFormBlocks,
  getFormResponseById,
  getUserFormResponses,
  createFormResponse,
  validateFormSubmission,
  formatResponseForDisplay,
  formatResponseForDiscord,
  setResponseDiscordWebhookFailed,
  setResponseDiscordForumPostFailed,
  setResponseDiscordForumThreadId,
} from "../controllers/formController.js";

export default function formSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  // ─── Public form page (fill out form) ───
  app.get("/forms/:slug", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;

    try {
      const form = await getFormBySlug(req.params.slug);
      if (!form || form.status !== "published") {
        return res.view("session/notFound", {
          pageTitle: "Form Not Found",
          config,
          req,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }

      if (form.requireLogin && !req.session.user) {
        const returnTo = encodeURIComponent(req.url);
        return res.redirect(`/login?returnTo=${returnTo}`);
      }

      const blocks = await getFormBlocks(form.formId);

      return res.view("modules/forms/form-submit", {
        pageTitle: form.name,
        config,
        req,
        features,
        form,
        blocks,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error loading form:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error loading form",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // ─── Submit form (POST) ───
  app.post("/forms/:slug/submit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;

    try {
      const form = await getFormBySlug(req.params.slug);
      if (!form || form.status !== "published") {
        setBannerCookie("danger", "This form is not currently accepting responses.", res);
        return res.redirect("/forms/" + req.params.slug);
      }

      if (form.requireLogin && !req.session.user) {
        return res.redirect(`/login?returnTo=${encodeURIComponent("/forms/" + req.params.slug)}`);
      }

      const blocks = await getFormBlocks(form.formId);

      // Build answers object from form body
      const answers = {};
      for (const block of blocks) {
        if (block.type === "title_description" || block.type === "section_break") {
          continue;
        }
        const fieldName = `block_${block.blockId}`;
        if (block.type === "checkboxes") {
          // Checkboxes come as multiple values with same name
          const val = req.body[fieldName];
          answers[block.blockId] = Array.isArray(val) ? val : val ? [val] : [];
        } else {
          answers[block.blockId] = req.body[fieldName] || "";
        }
      }

      // Validate
      const validationErrors = validateFormSubmission(blocks, answers);
      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.map((e) => e.message).join(" ");
        setBannerCookie("danger", errorMessage, res);
        return res.redirect("/forms/" + req.params.slug);
      }

      const submittedByUserId = req.session.user ? req.session.user.userId : null;
      const result = await createFormResponse(form.formId, submittedByUserId, answers);
      const responseId = result.insertId;

      // Discord delivery (async, non-blocking)
      deliverToDiscord(form, blocks, answers, responseId, submittedByUserId, client).catch((err) => {
        console.error("[Forms] Discord delivery error:", err);
      });

      setBannerCookie("success", "Your response has been submitted successfully.", res);

      if (form.submitterCanView && submittedByUserId) {
        return res.redirect(`/forms/${req.params.slug}/response/${responseId}`);
      }

      return res.redirect(`/forms/${req.params.slug}/submitted`);
    } catch (error) {
      console.error("Error submitting form:", error);
      setBannerCookie("danger", "An error occurred while submitting your response.", res);
      return res.redirect("/forms/" + req.params.slug);
    }
  });

  // ─── Submission confirmation page ───
  app.get("/forms/:slug/submitted", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;

    const form = await getFormBySlug(req.params.slug);

    return res.view("modules/forms/form-submitted", {
      pageTitle: "Response Submitted",
      config,
      req,
      features,
      form,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  // ─── View own response ───
  app.get("/forms/:slug/response/:responseId", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;

    try {
      if (!req.session.user) {
        return res.redirect(`/login?returnTo=${encodeURIComponent(req.url)}`);
      }

      const form = await getFormBySlug(req.params.slug);
      if (!form) {
        return res.view("session/notFound", {
          pageTitle: "Form Not Found",
          config,
          req,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }

      if (!form.submitterCanView) {
        setBannerCookie("danger", "Response viewing is not enabled for this form.", res);
        return res.redirect("/");
      }

      const response = await getFormResponseById(req.params.responseId);
      if (!response || response.formId !== form.formId) {
        return res.view("session/notFound", {
          pageTitle: "Response Not Found",
          config,
          req,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }

      // Only allow the submitter or staff to view
      const isSubmitter = response.submittedByUserId === req.session.user.userId;
      const isStaff = req.session.user.isStaff;
      if (!isSubmitter && !isStaff) {
        return res.view("session/noPermission", {
          pageTitle: "Access Restricted",
          config,
          req,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      }

      const blocks = await getFormBlocks(form.formId);
      const formattedAnswers = formatResponseForDisplay(blocks, response.answers);

      return res.view("modules/forms/form-response-view", {
        pageTitle: `Response #${response.responseId}`,
        config,
        req,
        features,
        form,
        response,
        blocks,
        formattedAnswers,
        moment,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error viewing response:", error);
      return res.view("session/error", {
        pageTitle: "Error",
        pageDescription: "Error viewing response",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  // ─── My responses ───
  app.get("/my/forms/responses", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.forms, req, res, features)) return;

    if (!req.session.user) {
      return res.redirect(`/login?returnTo=${encodeURIComponent(req.url)}`);
    }

    try {
      const responses = await getUserFormResponses(req.session.user.userId);

      return res.view("modules/forms/my-responses", {
        pageTitle: "My Form Responses",
        config,
        req,
        features,
        responses,
        moment,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } catch (error) {
      console.error("Error loading user responses:", error);
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
}

// ─── Discord Delivery (shared with form routes) ───

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
