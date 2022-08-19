import packageData from './package.json' assert {type: "json"};
import moment from 'moment';
import fetch from 'node-fetch';
import { SapphireClient } from '@sapphire/framework';
import { getGlobalImage } from './api/common';
import dotenv from 'dotenv';
dotenv.config()

import fastify from 'fastify';
import fastifySession from 'fastify-session';
import fastifyCookie from 'fastify-cookie';

import config from './config.json' assert {type: "json"};
import features from './features.json' assert {type: "json"};
import lang from './lang.json' assert {type: "json"};
import db from './controllers/databaseController';

// Paths
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 
// Discord
// 
const client = new SapphireClient({
    intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MEMBERS'],
    presence: {
        status: "online",
        activities: [{
            name: config.siteConfiguration.siteAddress,
            type: 'PLAYING'
        }]
    }
});

client.login(process.env.discordAPIKey);

//
// Cron Jobs
//
import('./cron/daily.js');
import monthlyCron from './cron/monthly.js';
setTimeout(function name() { monthlyCron(client); }, 5000)

// 
// Website Related
//

// Site Routes
import siteRoutes from './routes'
import apiRoutes from './api/routes'
import apiRedirectRoutes from './api/internal_redirect'

// API token authentication
import verifyToken from './api/routes/verifyToken'
import { setTimeout } from 'timers';

//
// Application Boot
//
const buildApp = async () => {
    
    const app = fastify({ logger: config.debug });
    const port = process.env.PORT || config.port || 8080;

    // When app can't found route, render the not found on a page, do not provide JSON
    // app.setNotFoundHandler(async (error, request, reply) => {
    //     if (error) {
    //         reply.code(404);
    //         reply.view('session/notFound', {
    //             "pageTitle": `404 : Not Found`,
    //             config: config,
    //             moment: moment,
    //             request: request,
    //             features: features,
    //             globalImage: await getGlobalImage(),
    //         });
    //     }
    // });
  
    // When app errors, render the error on a page, do not provide JSON
    app.setErrorHandler(async (error, request, reply) => {        
        reply.view('session/error', {
            "pageTitle": `Server Error`,
            config: config,
            error: error,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // EJS Rendering Engine
    app.register(await import("point-of-view"), {
        engine: {
          ejs: await import("ejs"),
        },
        root: path.join(__dirname, "views"),
    });

    app.register(await import('fastify-static'), {
        root: path.join(__dirname, 'assets'),
        prefix: '/',
    })

    app.register(await import ('fastify-formbody'))
    
    app.register((instance, options, next) => {
        // API routes (Token authenticated)
        instance.addHook('preValidation', verifyToken);
        apiRoutes(instance, client, moment, config, db, features, lang);
        next();
    });

    app.register((instance, options, next) => {
        // Don't authenticate the Redirect routes. These are
        // protected by 
        apiRedirectRoutes(instance, config, lang);
        next();
    });

    // Sessions
    app.register(fastifyCookie);
    app.register(fastifySession, {
        cookieName: 'sessionId',
        secret: process.env.sessionCookieSecret,
        cookie: { secure: false },
        expires: 1800000
    });

    app.register((instance, options, next) => {
        // Routes
        siteRoutes(instance, client, fetch, moment, config, db, features, lang);
        next();
    });

    app.addHook('preHandler', (request, reply, next) => {
        request.session.authenticated = false;
        next();
    });

    try {
        app.listen({ port: process.env.PORT }, (err) => {
            if (err) {
                app.log.error(err)
                process.exit(1)
              }
        })

        console.log(`\n// ${packageData.name} v.${packageData.version}\nGitHub Repository: ${packageData.homepage}\nCreated By: ${packageData.author}`);
        console.log(`Site and API is listening to the port ${port}`);
    } catch (error) {
        app.log.error(`Unable to start the server:\n${error}`);
    }
};

buildApp();