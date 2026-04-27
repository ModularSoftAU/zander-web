/**
 * Public Events Routes
 * Provides the public-facing events listing and event detail pages.
 */

import { getGlobalImage, isFeatureWebRouteEnabled, hashEmail } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import { getUpcomingPublishedEvents, getAllPublishedEvents, getPublishedEventBySlug } from "../services/eventService.js";
import { prisma } from "../controllers/databaseController.js";

/** Resolve an avatar URL from a users row. */
async function resolveAvatarUrl(user) {
  if (!user) return null;
  if (user.profilePicture_type === "CRAFTATAR" && user.uuid) {
    return `https://crafthead.net/avatar/${user.uuid}`;
  }
  if (user.profilePicture_type === "GRAVATAR" && user.profilePicture_email) {
    const hash = await hashEmail(user.profilePicture_email);
    return `https://gravatar.com/avatar/${hash}?size=128`;
  }
  if (user.uuid) return `https://crafthead.net/avatar/${user.uuid}`;
  return `https://mc-heads.net/avatar/${user.username}/128`;
}

/** Enrich event hosts with resolved avatar URLs. */
async function enrichHostsWithAvatars(hosts) {
  const userIds = hosts.map(h => h.userId).filter(Boolean);
  const users = userIds.length
    ? await prisma.users.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, uuid: true, username: true, profilePicture_type: true, profilePicture_email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.userId, u]));

  return Promise.all(hosts.map(async h => ({
    ...h,
    avatarUrl: h.userId ? await resolveAvatarUrl(userMap[h.userId] || null) : null,
  })));
}

export default function eventsRoutes(app, config, features) {
  // ============================================================================
  // Events Listing Page
  // ============================================================================
  app.get("/events", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;

    try {
      const page = Math.max(parseInt(req.query.page || "1"), 1);
      const [upcomingResult, allResult] = await Promise.all([
        getUpcomingPublishedEvents(6),
        getAllPublishedEvents(page, 12),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("modules/events/events-index", {
          pageTitle: "Events",
          pageDescription: `Upcoming and past community events for ${config.siteConfiguration.siteName}.`,
          config,
          req,
          features,
          upcomingEvents: upcomingResult,
          allEvents: allResult,
          currentPage: page,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        })
      );
    } catch (err) {
      console.error("[Events] listing error:", err);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error loading events",
          config,
          req,
          error: err,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        })
      );
    }
  });

  // ============================================================================
  // Event Detail Page
  // ============================================================================
  app.get("/events/:slug", async (req, res) => {
    if (!await isFeatureWebRouteEnabled(app, features.events, req, res, features)) return;

    try {
      const event = await getPublishedEventBySlug(req.params.slug);

      if (!event) {
        res.status(404);
        res.header("content-type", "text/html; charset=utf-8").send(
          await app.view("session/notFound", {
            pageTitle: "Event Not Found",
            config,
            req,
            features,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
          })
        );
        return;
      }

      // Enrich hosts with avatar URLs
      event.hosts = await enrichHostsWithAvatars(event.hosts || []);

      // Build ICS/calendar data
      const startTs = Math.floor(new Date(event.startAt).getTime() / 1000);
      const endTs = Math.floor(new Date(event.endAt).getTime() / 1000);

      // Google Calendar link
      const gcalStart = new Date(event.startAt).toISOString().replace(/[-:]/g, "").replace(".000", "");
      const gcalEnd = new Date(event.endAt).toISOString().replace(/[-:]/g, "").replace(".000", "");
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent((event.description || "").slice(0, 500))}&location=${encodeURIComponent(event.locationLabel || event.serverIp || "")}`;

      // Parse tags
      let tags = [];
      try {
        tags = Array.isArray(event.tags) ? event.tags : (event.tags ? JSON.parse(event.tags) : []);
      } catch { tags = []; }

      // Parse external links
      let externalLinks = [];
      try {
        externalLinks = Array.isArray(event.externalLinks) ? event.externalLinks : (event.externalLinks ? JSON.parse(event.externalLinks) : []);
      } catch { externalLinks = []; }

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("modules/events/events-detail", {
          pageTitle: event.title,
          pageDescription: event.description ? event.description.replace(/<[^>]+>/g, "").slice(0, 200) : `${event.title} — Community event on ${config.siteConfiguration.siteName}`,
          config,
          req,
          features,
          event,
          tags,
          externalLinks,
          startTs,
          endTs,
          gcalUrl,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        })
      );
    } catch (err) {
      console.error("[Events] detail error:", err);
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: "Error",
          pageDescription: "Error loading event",
          config,
          req,
          error: err,
          features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        })
      );
    }
  });
}
