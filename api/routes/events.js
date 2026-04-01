/**
 * Events API Routes
 * All event management endpoints — protected by API token via verifyToken middleware.
 */

import {
  getEvents,
  getEventsInRange,
  getEventById,
  getUpcomingPublishedEvents,
  getAllPublishedEvents,
  createEvent,
  updateEvent,
  submitForReview,
  approveEvent,
  rejectEvent,
  publishEvent,
  updatePublishedEvent,
  cancelEvent,
  deleteEvent,
  archiveEvent,
  upsertEventActions,
  upsertEventAnnouncements,
  getPendingReviewEvents,
  duplicateEvent,
} from "../../services/eventService.js";

import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../../services/eventTemplateService.js";

import {
  runDiscordActionsForEvent,
} from "../../services/eventDiscordService.js";

import { required, optional } from "../common.js";
import { createRequire } from "module";
import path from "path";
const _require = createRequire(import.meta.url);
const config = _require(path.join(process.cwd(), "config.json"));

function actorFromReq(req) {
  const user = req.session?.user;
  return {
    actorId: user?.userId || null,
    actorName: user?.username || "System",
  };
}

export default function eventsApiRoute(app, _config, _db, features, _lang) {
  // ============================================================================
  // Public endpoints (no auth check beyond token)
  // ============================================================================

  /** GET /api/events/upcoming - public upcoming events list */
  app.get("/api/events/upcoming", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });
    try {
      const limit = Math.min(parseInt(req.query.limit || "20"), 50);
      const events = await getUpcomingPublishedEvents(limit);
      return res.send({ success: true, data: events });
    } catch (err) {
      console.error("[Events API] upcoming:", err);
      return res.send({ success: false, message: "Failed to fetch upcoming events" });
    }
  });

  /** GET /api/events/published - all published events */
  app.get("/api/events/published", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });
    try {
      const page = Math.max(parseInt(req.query.page || "1"), 1);
      const limit = Math.min(parseInt(req.query.limit || "20"), 100);
      const result = await getAllPublishedEvents(page, limit);
      return res.send({ success: true, ...result });
    } catch (err) {
      console.error("[Events API] published:", err);
      return res.send({ success: false, message: "Failed to fetch published events" });
    }
  });

  // ============================================================================
  // Event list / search (dashboard)
  // ============================================================================

  /** GET /api/events/get - get events with filters */
  app.get("/api/events/get", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    try {
      const result = await getEvents({
        status: req.query.status || null,
        eventType: req.query.eventType || null,
        search: req.query.search || null,
        templateId: req.query.templateId ? parseInt(req.query.templateId) : null,
        page: Math.max(parseInt(req.query.page || "1"), 1),
        limit: Math.min(parseInt(req.query.limit || "50"), 200),
      });
      return res.send({ success: true, ...result });
    } catch (err) {
      console.error("[Events API] get:", err);
      return res.send({ success: false, message: "Failed to fetch events" });
    }
  });

  /** GET /api/events/calendar - events in date range */
  app.get("/api/events/calendar", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    try {
      const { start, end } = req.query;
      if (!start || !end) return res.send({ success: false, message: "start and end query params required" });

      const events = await getEventsInRange(start, end);
      return res.send({ success: true, data: events });
    } catch (err) {
      console.error("[Events API] calendar:", err);
      return res.send({ success: false, message: "Failed to fetch calendar events" });
    }
  });

  /** GET /api/events/pending-review */
  app.get("/api/events/pending-review", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    try {
      const events = await getPendingReviewEvents();
      return res.send({ success: true, data: events });
    } catch (err) {
      console.error("[Events API] pending-review:", err);
      return res.send({ success: false, message: "Failed to fetch pending events" });
    }
  });

  /** GET /api/events/single?eventId=X */
  app.get("/api/events/single", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    try {
      const eventId = req.query.eventId;
      if (!eventId) return res.send({ success: false, message: "eventId required" });

      const event = await getEventById(eventId);
      if (!event) return res.send({ success: false, message: "Event not found" });

      return res.send({ success: true, data: event });
    } catch (err) {
      console.error("[Events API] single:", err);
      return res.send({ success: false, message: "Failed to fetch event" });
    }
  });

  // ============================================================================
  // Event lifecycle
  // ============================================================================

  /** POST /api/events/create */
  app.post("/api/events/create", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const body = req.body;
    if (!body?.title) return res.send({ success: false, message: "title is required" });
    if (!body?.startAt) return res.send({ success: false, message: "startAt is required" });
    if (!body?.endAt) return res.send({ success: false, message: "endAt is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await createEvent(body, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event draft created" });
    } catch (err) {
      console.error("[Events API] create:", err);
      return res.send({ success: false, message: err.message || "Failed to create event" });
    }
  });

  /** POST /api/events/update */
  app.post("/api/events/update", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const body = req.body;
    if (!body?.eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await updateEvent(body.eventId, body, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event updated" });
    } catch (err) {
      console.error("[Events API] update:", err);
      return res.send({ success: false, message: err.message || "Failed to update event" });
    }
  });

  /** POST /api/events/submit-review */
  app.post("/api/events/submit-review", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const eventId = req.body?.eventId;
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await submitForReview(eventId, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event submitted for review" });
    } catch (err) {
      console.error("[Events API] submit-review:", err);
      return res.send({ success: false, message: err.message || "Failed to submit event" });
    }
  });

  /** POST /api/events/approve */
  app.post("/api/events/approve", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const eventId = req.body?.eventId;
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await approveEvent(eventId, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event approved" });
    } catch (err) {
      console.error("[Events API] approve:", err);
      return res.send({ success: false, message: err.message || "Failed to approve event" });
    }
  });

  /** POST /api/events/reject */
  app.post("/api/events/reject", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId, rejectionNote } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await rejectEvent(eventId, actorId, actorName, rejectionNote);
      return res.send({ success: true, data: event, message: "Event rejected" });
    } catch (err) {
      console.error("[Events API] reject:", err);
      return res.send({ success: false, message: err.message || "Failed to reject event" });
    }
  });

  /** POST /api/events/publish */
  app.post("/api/events/publish", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await publishEvent(eventId, actorId, actorName);

      // Reload with actions
      const fullEvent = await getEventById(eventId);

      // Run downstream actions asynchronously (don't block the response)
      setImmediate(async () => {
        try {
          const discordCfg = {
            channelId: config?.events?.discordChannelId || null,
            guildId: config?.events?.discordGuildId || null,
          };
          await runDiscordActionsForEvent(fullEvent, "on_publish", discordCfg);
        } catch (e) {
          console.error("[Events] Discord actions failed:", e.message);
        }
      });

      return res.send({ success: true, data: event, message: "Event published" });
    } catch (err) {
      console.error("[Events API] publish:", err);
      return res.send({ success: false, message: err.message || "Failed to publish event" });
    }
  });

  /** POST /api/events/update-published */
  app.post("/api/events/update-published", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const body = req.body || {};
    if (!body?.eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await updatePublishedEvent(body.eventId, body, actorId, actorName);

      // Run downstream sync asynchronously
      const fullEvent = await getEventById(body.eventId);
      setImmediate(async () => {
        try {
          const discordCfg = {
            channelId: config?.events?.discordChannelId || null,
            guildId: config?.events?.discordGuildId || null,
          };
          await runDiscordActionsForEvent(fullEvent, "on_update", discordCfg);
        } catch (e) {
          console.error("[Events] Discord sync failed:", e.message);
        }
      });

      return res.send({ success: true, data: event, message: "Published event updated and sync triggered" });
    } catch (err) {
      console.error("[Events API] update-published:", err);
      return res.send({ success: false, message: err.message || "Failed to update event" });
    }
  });

  /** POST /api/events/cancel */
  app.post("/api/events/cancel", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId, reason } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await cancelEvent(eventId, actorId, actorName, reason);

      // Cancel Discord guild event if exists
      const fullEvent = await getEventById(eventId, true);
      setImmediate(async () => {
        try {
          const discordCfg = {
            guildId: config?.events?.discordGuildId || null,
          };
          await runDiscordActionsForEvent(fullEvent, "on_cancel", discordCfg);
        } catch (e) {
          console.error("[Events] Discord cancel sync failed:", e.message);
        }
      });

      return res.send({ success: true, data: event, message: "Event cancelled" });
    } catch (err) {
      console.error("[Events API] cancel:", err);
      return res.send({ success: false, message: err.message || "Failed to cancel event" });
    }
  });

  /** POST /api/events/archive */
  app.post("/api/events/archive", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await archiveEvent(eventId, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event archived" });
    } catch (err) {
      console.error("[Events API] archive:", err);
      return res.send({ success: false, message: err.message || "Failed to archive event" });
    }
  });

  /** POST /api/events/delete */
  app.post("/api/events/delete", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await deleteEvent(eventId, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event deleted" });
    } catch (err) {
      console.error("[Events API] delete:", err);
      return res.send({ success: false, message: err.message || "Failed to delete event" });
    }
  });

  /** POST /api/events/duplicate */
  app.post("/api/events/duplicate", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const event = await duplicateEvent(eventId, actorId, actorName);
      return res.send({ success: true, data: event, message: "Event duplicated as draft" });
    } catch (err) {
      console.error("[Events API] duplicate:", err);
      return res.send({ success: false, message: err.message || "Failed to duplicate event" });
    }
  });

  // ============================================================================
  // Actions & Announcements
  // ============================================================================

  /** POST /api/events/actions/update */
  app.post("/api/events/actions/update", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId, actions } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      await upsertEventActions(eventId, actions || [], actorId, actorName);
      return res.send({ success: true, message: "Actions updated" });
    } catch (err) {
      console.error("[Events API] actions/update:", err);
      return res.send({ success: false, message: err.message || "Failed to update actions" });
    }
  });

  /** POST /api/events/announcements/update */
  app.post("/api/events/announcements/update", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { eventId, announcements } = req.body || {};
    if (!eventId) return res.send({ success: false, message: "eventId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      await upsertEventAnnouncements(eventId, announcements || [], actorId, actorName);
      return res.send({ success: true, message: "Announcements updated" });
    } catch (err) {
      console.error("[Events API] announcements/update:", err);
      return res.send({ success: false, message: err.message || "Failed to update announcements" });
    }
  });

  // ============================================================================
  // Templates
  // ============================================================================

  /** GET /api/events/templates/get */
  app.get("/api/events/templates/get", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    try {
      const templates = await getTemplates();
      return res.send({ success: true, data: templates });
    } catch (err) {
      console.error("[Events API] templates/get:", err);
      return res.send({ success: false, message: "Failed to fetch templates" });
    }
  });

  /** GET /api/events/templates/single?templateId=X */
  app.get("/api/events/templates/single", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { templateId } = req.query;
    if (!templateId) return res.send({ success: false, message: "templateId required" });

    try {
      const tmpl = await getTemplateById(templateId);
      if (!tmpl) return res.send({ success: false, message: "Template not found" });
      return res.send({ success: true, data: tmpl });
    } catch (err) {
      console.error("[Events API] templates/single:", err);
      return res.send({ success: false, message: "Failed to fetch template" });
    }
  });

  /** POST /api/events/templates/create */
  app.post("/api/events/templates/create", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    if (!req.body?.title) return res.send({ success: false, message: "title is required" });

    try {
      const { actorId } = actorFromReq(req);
      const tmpl = await createTemplate(req.body, actorId);
      return res.send({ success: true, data: tmpl, message: "Template created" });
    } catch (err) {
      console.error("[Events API] templates/create:", err);
      return res.send({ success: false, message: err.message || "Failed to create template" });
    }
  });

  /** POST /api/events/templates/update */
  app.post("/api/events/templates/update", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { templateId } = req.body || {};
    if (!templateId) return res.send({ success: false, message: "templateId is required" });

    try {
      const { actorId } = actorFromReq(req);
      const tmpl = await updateTemplate(templateId, req.body, actorId);
      return res.send({ success: true, data: tmpl, message: "Template updated" });
    } catch (err) {
      console.error("[Events API] templates/update:", err);
      return res.send({ success: false, message: err.message || "Failed to update template" });
    }
  });

  /** POST /api/events/templates/delete */
  app.post("/api/events/templates/delete", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { templateId } = req.body || {};
    if (!templateId) return res.send({ success: false, message: "templateId is required" });

    try {
      await deleteTemplate(templateId);
      return res.send({ success: true, message: "Template deleted" });
    } catch (err) {
      console.error("[Events API] templates/delete:", err);
      return res.send({ success: false, message: err.message || "Failed to delete template" });
    }
  });

  /** POST /api/events/templates/generate-draft - manually trigger draft generation */
  app.post("/api/events/templates/generate-draft", async (req, res) => {
    if (!features.events) return res.send({ success: false, message: "Events feature disabled" });

    if (!req.session?.user) return res.send({ success: false, message: "Authentication required" });

    const { templateId, targetDate } = req.body || {};
    if (!templateId) return res.send({ success: false, message: "templateId is required" });

    try {
      const { actorId, actorName } = actorFromReq(req);
      const tmpl = await getTemplateById(templateId);
      if (!tmpl) return res.send({ success: false, message: "Template not found" });

      const { generateDraftFromTemplate, computeNextEventDate } = await import("../../services/eventTemplateService.js");

      const date = targetDate ? new Date(targetDate) : computeNextEventDate(tmpl);
      if (!date) return res.send({ success: false, message: "Could not determine next event date" });

      const event = await generateDraftFromTemplate(tmpl, date, actorId, actorName);
      return res.send({ success: true, data: event, message: "Draft event generated from template" });
    } catch (err) {
      console.error("[Events API] templates/generate-draft:", err);
      return res.send({ success: false, message: err.message || "Failed to generate draft" });
    }
  });
}
