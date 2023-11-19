import packageData from './package.json' assert {type: "json"};
import moment from 'moment';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config()

import fastify from 'fastify';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';

import config from './config.json' assert {type: "json"};
import features from './features.json' assert {type: "json"};
import lang from './lang.json' assert {type: "json"};
import db from './controllers/databaseController';
import { getWebAnnouncement } from './controllers/announcementController';

// Paths
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import('./controllers/discordController.js');

// 
// Website Related
//

// Site Routes
import siteRoutes from './routes'
import apiRoutes from './api/routes'
import apiRedirectRoutes from './api/internal_redirect'

// API token authentication
import verifyToken from './api/routes/verifyToken'
import { getGlobalImage } from './api/common';
import { client } from './controllers/discordController';

//
// Application Boot
//
const buildApp = async () => {
    
    const app = fastify({ logger: config.debug });
  
    // When app errors, render the error on a page, do not provide JSON
    app.setErrorHandler(async function (error, req, res) {
        res.view('session/error', {
            "pageTitle": `Server Error`,
            config: config,
            error: error,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
        });
    });

    // When app errors, render the error on a page, do not provide JSON
    app.setNotFoundHandler(async function (req, res) {
        return res.view('session/notFound', {
            "pageTitle": `404 Not Found`,
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

    await app.register(await import('@fastify/static'), {
        root: path.join(__dirname, 'assets'),
        prefix: '/',
    })

    await app.register(await import ('@fastify/formbody'))
    
    await app.register((instance, options, next) => {
        // API routes (Token authenticated)
        instance.addHook('preValidation', verifyToken);
        apiRoutes(instance, client, moment, config, db, features, lang);
        next();
    });

    await app.register((instance, options, next) => {
        // Don't authenticate the Redirect routes. These are
        // protected by 
        apiRedirectRoutes(instance, config, lang);
        next();
    });

    // Sessions
    await app.register(fastifyCookie, {
        secret: process.env.sessionCookieSecret, // for cookies signature
    });

    await app.register(fastifySession, {
        cookieName: 'sessionId',
        secret: process.env.sessionCookieSecret,
        cookie: { secure: false },
        expires: 1800000
    });

    await app.register((instance, options, next) => {
        // Routes
        siteRoutes(instance, client, fetch, moment, config, db, features, lang);
        next();
    });

    app.addHook('preHandler', (req, res, next) => {
        req.session.authenticated = false;
        next();
    });

    try {
        const port = process.env.PORT;

        app.listen({ port: port, host: '0.0.0.0' }, (err) => {
            if (err) {
                app.log.error(err);
                process.exit(1);
            }
        })

        console.log(`\n// ${packageData.name} v.${packageData.version}\nGitHub Repository: ${packageData.homepage}\nCreated By: ${packageData.author}`);
        console.log(`Site and API is listening to the port ${process.env.PORT}`);
    } catch (error) {
        app.log.error(`Unable to start the server:\n${error}`);
    }
};

buildApp();