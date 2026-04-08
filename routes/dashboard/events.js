/**
 * Dashboard Events Routes
 * Provides the admin-facing calendar, list, editor, template management, and approval UI.
 */

import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
  setBannerCookie,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";

/** Fetch a URL with the internal API key and parse JSON, returning fallback on error. */
async function fetchJson(fetchFn, url, fallback = null) {
  try {
    const res = await fetchFn(url, {
      headers: { "x-access-token": process.env.apiKey },
    });
    return await res.json();
  } catch (error) {
    console.error(`[dashboard/events] fetchJson failed for ${url}:`, error.message);
    return fallback;
  }
}

export default function dashboardEventsSiteRoute(app, fetch, config, db, features, lang) {
  // ============================================================================
  // Calendar View
  // ============================================================================
  app.get("/dashboard/events", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const [globalImage, announcementWeb] = await Promise.all([
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-calendar", {
        pageTitle: "Dashboard - Events Calendar",
        config,
        features,
        req,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // List View
  // ============================================================================
  app.get("/dashboard/events/list", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const statusFilter = req.query.status || "";
    const search = req.query.search || "";

    let qs = "";
    if (statusFilter) qs += `&status=${encodeURIComponent(statusFilter)}`;
    if (search) qs += `&search=${encodeURIComponent(search)}`;

    const fetchURL = `${process.env.siteAddress}/api/events/get?limit=100${qs}`;

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, fetchURL, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-list", {
        pageTitle: "Dashboard - Events",
        config,
        features,
        req,
        apiData,
        statusFilter,
        search,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // Approval Queue
  // ============================================================================
  app.get("/dashboard/events/review", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events.review", req, res, features)) return;

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, `${process.env.siteAddress}/api/events/pending-review`, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-review", {
        pageTitle: "Dashboard - Event Review Queue",
        config,
        features,
        req,
        apiData,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // Create Event
  // ============================================================================
  app.get("/dashboard/events/create", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const [templatesData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, `${process.env.siteAddress}/api/events/templates/get`, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-editor", {
        pageTitle: "Dashboard - Create Event",
        config,
        features,
        req,
        mode: "create",
        eventData: null,
        templatesData,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // Edit Event
  // ============================================================================
  app.get("/dashboard/events/edit", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const eventId = req.query.eventId;
    if (!eventId) return res.redirect("/dashboard/events/list");

    const [apiData, templatesData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, `${process.env.siteAddress}/api/events/single?eventId=${eventId}`, null),
      fetchJson(fetch, `${process.env.siteAddress}/api/events/templates/get`, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    if (!apiData || !apiData.success) {
      await setBannerCookie("danger", "Event not found", res);
      return res.redirect("/dashboard/events/list");
    }

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-editor", {
        pageTitle: `Dashboard - Edit Event`,
        config,
        features,
        req,
        mode: "edit",
        eventData: apiData.data,
        templatesData,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // View Event (read-only detail with audit log)
  // ============================================================================
  app.get("/dashboard/events/view", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const eventId = req.query.eventId;
    if (!eventId) return res.redirect("/dashboard/events/list");

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, `${process.env.siteAddress}/api/events/single?eventId=${eventId}`, null),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    if (!apiData || !apiData.success) {
      await setBannerCookie("danger", "Event not found", res);
      return res.redirect("/dashboard/events/list");
    }

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-view", {
        pageTitle: `Dashboard - ${apiData.data.title}`,
        config,
        features,
        req,
        eventData: apiData.data,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // Templates List
  // ============================================================================
  app.get("/dashboard/events/templates", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, `${process.env.siteAddress}/api/events/templates/get`, { data: [] }),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-templates", {
        pageTitle: "Dashboard - Event Templates",
        config,
        features,
        req,
        apiData,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // Create Template
  // ============================================================================
  app.get("/dashboard/events/templates/create", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const [globalImage, announcementWeb] = await Promise.all([
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-template-editor", {
        pageTitle: "Dashboard - Create Event Template",
        config,
        features,
        req,
        mode: "create",
        templateData: null,
        globalImage,
        announcementWeb,
      })
    );
  });

  // ============================================================================
  // Edit Template
  // ============================================================================
  app.get("/dashboard/events/templates/edit", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;
    if (!await hasPermission("zander.web.events", req, res, features)) return;

    const templateId = req.query.templateId;
    if (!templateId) return res.redirect("/dashboard/events/templates");

    const [apiData, globalImage, announcementWeb] = await Promise.all([
      fetchJson(fetch, `${process.env.siteAddress}/api/events/templates/single?templateId=${templateId}`, null),
      getGlobalImage(),
      getWebAnnouncement(),
    ]);

    if (!apiData || !apiData.success) {
      await setBannerCookie("danger", "Template not found", res);
      return res.redirect("/dashboard/events/templates");
    }

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/events/events-template-editor", {
        pageTitle: "Dashboard - Edit Event Template",
        config,
        features,
        req,
        mode: "edit",
        templateData: apiData.data,
        globalImage,
        announcementWeb,
      })
    );
  });
}
