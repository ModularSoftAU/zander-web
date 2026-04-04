import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Prevent unhandled promise rejections (e.g. Discord API / webhook errors) from
// crashing the process. Fastify handles errors within request handlers, but
// bot listeners and cron jobs run outside that lifecycle.
process.on("unhandledRejection", (reason, promise) => {
  console.error("[UNHANDLED REJECTION]", promise, "Reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
});

const packageData = require("./package.json");
import moment from "moment";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

import fastify from "fastify";
import fastifySession from "@fastify/session";
import fastifyCookie from "@fastify/cookie";
import { FastifyPrismaSessionStore } from "./lib/fastifyPrismaSessionStore.js";

const config = require("./config.json");
const features = require("./features.json");
const lang = require("./lang.json");
import db, { isDbHealthy, prisma } from "./controllers/databaseController.js";
import { getWebAnnouncement } from "./controllers/announcementController.js";
import { getNotificationSummary } from "./controllers/notificationController.js";

// Paths
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import("./controllers/discordController.js");
import("./cron/userCodeExpiryCron.js");
import("./cron/bridgeCleanupCron.js");
import("./cron/cakeDayUserCheck.js");
import("./cron/staffAuditReportCron.js");
import("./cron/schedulerCron.js");
import("./cron/nicknameCheckCron.js");
import("./cron/punishmentExpiryCron.js");
import("./cron/watchTwitchCron.js");
import("./cron/watchYoutubeCron.js");
import("./cron/voteMonthlyRewardCron.js");
import("./cron/unverifiedReminderCron.js");
import("./cron/eventAnnouncementCron.js");
import("./cron/eventTemplateCron.js");
import("./cron/announcementExpiryCron.js");

//
// Website Related
//

// Site Routes
import siteRoutes from "./routes/index.js";
import apiRoutes from "./api/routes/index.js";
import apiRedirectRoutes from "./api/internal_redirect/index.js";
import configApiRoute from "./api/routes/config.js";

// API token authentication
import verifyToken from "./api/routes/verifyToken.js";
import { getGlobalImage } from "./api/common.js";
import { client } from "./controllers/discordController.js";

//
// Application Boot
//
const buildApp = async () => {
  // pluginTimeout raised to 120 s (default is 10 s).
  // The Sapphire Framework's ApplicationCommandRegistries initialisation can
  // take 60+ seconds while registering Discord slash commands, which can delay
  // event-loop ticks long enough for avvio to fire the default 10-second
  // timeout before route-registration plugins have a chance to complete.
  const app = fastify({ logger: config.debug, pluginTimeout: 120000 });

  // When app errors, render the error on a page, do not provide JSON
  app.setNotFoundHandler(async function (req, res) {
    res.status(404);

    try {
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/notFound", {
          pageTitle: `404 Not Found`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        })
      );
    } catch (viewError) {
      app.log.error(viewError);
      res.send("404 Not Found");
    }
  });

  // When app errors, render the error on a page, do not provide JSON
  app.setErrorHandler(async function (error, req, res) {
    if (res.sent) {
      // ERR_HTTP_HEADERS_SENT is an expected side-effect of HEAD requests:
      // @fastify/session's async Prisma save resolves after headRouteOnSendHandler
      // already committed the response, so the Set-Cookie write races the finalize.
      // Nothing to do — the response was delivered correctly.
      if (error.code !== "ERR_HTTP_HEADERS_SENT") {
        app.log.warn({ err: error }, "error after reply already sent");
      }
      return;
    }

    app.log.error(error);

    const statusCode =
      typeof error?.statusCode === "number" && error.statusCode >= 400
        ? error.statusCode
        : 500;

    res.status(statusCode);

    // If the request is for the API, return JSON instead of a view
    if (req.url.startsWith("/api/")) {
      return res.send({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }

    try {
      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/error", {
          pageTitle: `Server Error`,
          config: config,
          error: error,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        })
      );
    } catch (viewError) {
      app.log.error(viewError);
      res.send("Internal Server Error");
    }
  });

  // Show a maintenance page instead of hanging when the database is unreachable.
  // Runs before session handling so no DB access is attempted.
  // The maintenance view is self-contained (CDN-only CSS) so the browser
  // will not make further requests to this server for stylesheets or scripts.
  app.addHook("onRequest", async (req, res) => {
    if (isDbHealthy() !== false) return; // up or not-yet-known: let through
    if (req.url === "/api/heartbeat") return; // allow monitoring to detect the outage

    res.status(503);

    // API callers get JSON; browsers get the maintenance page
    if (req.url.startsWith("/api/")) {
      return res.send({ success: false, message: "Service temporarily unavailable. The database is unreachable." });
    }

    try {
      return res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("session/maintenance", {
          pageTitle: "Down for Maintenance",
          config,
        })
      );
    } catch {
      return res.send("<h1>Down for Maintenance</h1><p>We'll be back shortly.</p>");
    }
  });

  // EJS Rendering Engine
  await app.register(await import("@fastify/view"), {
    engine: {
      ejs: await import("ejs"),
    },
    root: path.join(__dirname, "views"),
  });

  await app.register(await import("@fastify/static"), {
    root: path.join(__dirname, "assets"),
    prefix: "/",
  });

  await app.register(await import("@fastify/formbody"), { bodyLimit: 10485760 }); // 10 MB
  await app.register(await import("@fastify/multipart"));

  await app.register((instance, options, next) => {
    // API routes (Token authenticated)
    try {
      instance.addHook("preValidation", verifyToken);
      apiRoutes(instance, client, moment, config, db, features, lang);
    } catch (err) {
      return next(err);
    }
    next();
  });

  // Heartbeat — public, no token required so monitoring tools can reach it
  app.get("/api/heartbeat", async function (req, res) {
    return res.send({
      success: true,
      message: `OK`,
    });
  });

  await app.register((instance, options, next) => {
    // Don't authenticate the Redirect routes. These are
    // protected by
    try {
      apiRedirectRoutes(instance, config, lang, features);
    } catch (err) {
      return next(err);
    }
    next();
  });

  await app.register(
    async (instance) => {
      // Config API routes (No token authentication)
      configApiRoute(instance, config, db, features, lang);
    },
    { prefix: "/api/config" }
  );

  // Sessions — persisted via Prisma so logins survive app restarts.
  // The sessions table is created by the baseline migration.
  const sessionStore = new FastifyPrismaSessionStore();

  await app.register(fastifyCookie, {
    secret: process.env.sessionCookieSecret, // for cookies signature
  });

  await app.register(fastifySession, {
    cookieName: "sessionId",
    secret: process.env.sessionCookieSecret,
    store: sessionStore,
    cookie: {
      secure: false,
      maxAge: 86400000 * 7, // 7 days default
      httpOnly: true,
      sameSite: "lax",
    },
    saveUninitialized: false,
    // rolling: false — do not refresh the session cookie / extend TTL on every
    // read-only request.  Without this, @fastify/session calls store.touch()
    // on EVERY authenticated page load, blocking the onSend pipeline until
    // Prisma completes a DB write — the primary cause of blank pages under
    // any transient DB latency.  Sessions still expire 7 days after last
    // write (login, perm change, etc.).
    rolling: false,
  });

  // Must be registered before siteRoutes so it applies to all site route
  // handlers. Setting req.session.authenticated (which was never read anywhere)
  // has been removed — it caused @fastify/session to treat every request as a
  // modified session and trigger a Prisma INSERT on every request, including
  // unauthenticated ones. On Prisma cold-start this INSERT hangs, holding up
  // the onSend pipeline and producing a blank page on first load.
  app.addHook("preHandler", async (req, res) => {
    req.notifications = { unreadCount: 0, items: [] };

    if (req.session?.user?.userId) {
      try {
        req.notifications = await getNotificationSummary(req.session.user.userId, 5);
      } catch (error) {
        app.log.error(error);
      }
    }
  });

  await app.register((instance, options, next) => {
    // Routes
    try {
      siteRoutes(instance, client, fetch, moment, config, db, features, lang);
    } catch (err) {
      return next(err);
    }
    next();
  });

  // Warm up the Prisma connection pool before accepting requests so the first
  // visitor does not trigger a cold-start DB connection during the onSend
  // session-save phase, which could delay or silently drop the response.
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[DB] Prisma connection warmed up.");
  } catch (err) {
    console.warn("[DB] Prisma warm-up query failed (will retry on first request):", err.message);
  }

  try {
    const port = process.env.PORT;

    app.listen({ port: port, host: "0.0.0.0" }, (err) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
    });

    console.log(
      `\n// ${packageData.name} v.${packageData.version}\nGitHub Repository: ${packageData.homepage}\nCreated By: ${packageData.author}`
    );
    console.log(`Site and API is listening to the port ${process.env.PORT}`);
  } catch (error) {
    app.log.error(`Unable to start the server:\n${error}`);
  }
};

// If buildApp() rejects (e.g. a plugin registration failure), log the full
// error and exit so the process manager (Render) restarts the service
// immediately rather than leaving it running silently with no open port.
buildApp().catch((err) => {
  console.error("[FATAL] buildApp() failed — exiting:", err);
  process.exit(1);
});
