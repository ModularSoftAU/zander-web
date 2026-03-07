import { createRequire } from "module";
const require = createRequire(import.meta.url);

const packageData = require("./package.json");
import moment from "moment";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

import fastify from "fastify";
import fastifySession from "@fastify/session";
import fastifyCookie from "@fastify/cookie";
import expressMySQLSession from "express-mysql-session";

const config = require("./config.json");
const features = require("./features.json");
const lang = require("./lang.json");
import db from "./controllers/databaseController.js";
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
  const app = fastify({ logger: config.debug });

  // When app errors, render the error on a page, do not provide JSON
  app.setNotFoundHandler(async function (req, res) {
    res.status(404);

    return res.view("session/notFound", {
      pageTitle: `404 Not Found`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  // When app errors, render the error on a page, do not provide JSON
  app.setErrorHandler(async function (error, req, res) {
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

    return res.view("session/error", {
      pageTitle: `Server Error`,
      config: config,
      error: error,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
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
    instance.addHook("preValidation", verifyToken);
    apiRoutes(instance, client, moment, config, db, features, lang);
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
    apiRedirectRoutes(instance, config, lang, features);
    next();
  });

  await app.register(
    async (instance) => {
      // Config API routes (No token authentication)
      configApiRoute(instance, config, db, features, lang);
    },
    { prefix: "/api/config" }
  );

  // Sessions — persisted to MySQL so logins survive app restarts
  const MySQLStore = expressMySQLSession(fastifySession);
  const sessionStore = new MySQLStore({
    host: process.env.databaseHost,
    port: process.env.databasePort,
    user: process.env.databaseUser,
    password: process.env.databasePassword,
    database: process.env.databaseName,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000 * 7, // 7 days default
  });

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
  });

  await app.register((instance, options, next) => {
    // Routes
    siteRoutes(instance, client, fetch, moment, config, db, features, lang);
    next();
  });

  app.addHook("preHandler", async (req, res) => {
    if (req.session) {
      req.session.authenticated = false;
    }
    req.notifications = { unreadCount: 0, items: [] };

    if (req.session?.user?.userId) {
      try {
        req.notifications = await getNotificationSummary(req.session.user.userId, 5);
      } catch (error) {
        app.log.error(error);
      }
    }
  });

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

buildApp();
