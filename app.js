import packageData from './package.json' assert {type: "json"};
import moment from 'moment'
import fetch from 'node-fetch'
import { SapphireClient } from '@sapphire/framework';

import fastify from 'fastify';
import fastifySession from 'fastify-session'
import fastifyCookie from 'fastify-cookie'

import config from './config.json' assert {type: "json"};
import features from './features.json' assert {type: "json"};
import lang from './lang.json' assert {type: "json"};
import db from './controllers/databaseController'

// Paths
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 
// Discord
// 
const DiscordClient = new SapphireClient({
    intents: ['GUILDS', 'GUILD_MESSAGES'],
    loadMessageCommandListeners: true
});

DiscordClient.login(config.discord.apiKey);

// 
// Website Related
//

// Site Routes
import siteRoutes from './routes'
import apiRoutes from './api/routes'

// API token authentication
import verifyToken from './api/routes/verifyToken'

//
// Application Boot
//
const buildApp = async () => {
    const app = fastify({ logger: config.debug });
    const port = process.env.PORT || config.port || 8080;

    // When app can't found route, render the not found on a page, do not provide JSON
    // app.setNotFoundHandler((error, request, reply) => {        
    //     reply.view('session/notFound', {
    //         "pageTitle": `404: Not Found`,
    //         config: config,
    //         error: error
    //     });
    // });
  
    // When app errors, render the error on a page, do not provide JSON
    app.setErrorHandler((error, request, reply) => {        
        reply.view('session/error', {
            "pageTitle": `Server Error`,
            config: config,
            error: error,
            request: request
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
        apiRoutes(instance, DiscordClient, moment, config, db, features, lang);
        next();
    });

    // Sessions
    app.register(fastifyCookie);
    app.register(fastifySession, {
        cookieName: 'sessionId',
        secret: config.siteConfiguration.sessionCookieSecret,
        cookie: { secure: false },
        expires: 1800000
    });

    app.register((instance, options, next) => {
        // Routes
        siteRoutes(instance, fetch, moment, config, db, features, lang);
        next();
    });

    try {
        app.listen(process.env.PORT || config.port, '0.0.0.0', (err) => {
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