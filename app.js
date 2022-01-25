import packageData from './package.json'
import DiscordJS from 'discord.js'
import WOKCommands from 'wokcommands'
import moment from 'moment'
import fetch from 'node-fetch'
import fastify from "fastify"

import config from './config.json'
import db from './controllers/databaseController'

// Paths
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 
// Discord Related
// 
const { Intents } = DiscordJS

const DiscordClient = new DiscordJS.Client({
    // These intents are recommended for the built in help menu
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],
})

DiscordClient.on('ready', () => {
    new WOKCommands(DiscordClient, {
            // The name of the local folder for your command files
            commandsDir: path.join(__dirname, 'discord/commands'),

            // The name of the local folder for your feature files
            featuresDir: path.join(__dirname, 'discord/features'),

            // If WOKCommands warning should be shown or not, default true
            showWarns: false,

            // How many seconds to keep error messages before deleting them
            // -1 means do not delete, defaults to -1
            delErrMsgCooldown: -1,

            // If your commands should not be ran by a bot, default false
            ignoreBots: true,

            // If interactions should only be shown to the one user
            // Only used for when WOKCommands sends an interaction response
            // Default is true
            ephemeral: true,

            typeScript: true,

            // What server/guild IDs are used for testing only commands & features
            // Can be a single string if there is only 1 ID
            testServers: ['899441191416901632', '581056239312568332'],

            // User your own ID
            // If you only have 1 ID then you can pass in a string instead
            botOwners: ['169978063478587392'],

            // Provides additional debug logging
            debug: false
        })
})

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
    const app = fastify({ logger: false });
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
            error: error
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
        apiRoutes(instance, DiscordClient, moment, config, db);
        next();
    });

    app.register((instance, options, next) => {
        // Routes
        siteRoutes(instance, fetch, moment, config);
        next();
    });

    try {
        const port = process.env.PORT || config.port || 8080;
        await app.listen(port);
        console.log(`\n// ${packageData.name} v.${packageData.version}\nGitHub Repository: ${packageData.homepage}\nCreated By: ${packageData.author}`);
        console.log(`Site and API is listening to the port ${port}`);
    } catch (error) {
        app.log.error(`Unable to start the server:\n${error}`);
    }
};

buildApp();