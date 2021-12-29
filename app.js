const express = require('express');
const package = require('./package.json');
const config = require('./config.json');
const DiscordJS = require('discord.js');
const WOKCommands = require('wokcommands');
const path = require('path');

// 
// Discord Related
// 
const { Intents } = DiscordJS

const DiscordClient = new DiscordJS.Client({
  // These intents are recommended for the built in help menu
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
})

DiscordClient.on('ready', () => {
    // The client object is required as the first argument.
    // The second argument is the options object.
    // All properties of this object are optional.

    new WOKCommands(DiscordClient, {
        // The name of the local folder for your command files
        commandsDir: path.join(__dirname, 'discord/commands'),
        
        // The name of the local folder for your feature files
        featuresDir: path.join(__dirname, 'discord/features'),
        
        // If WOKCommands warning should be shown or not, default true
        showWarns: true,
        
        // How many seconds to keep error messages before deleting them
        // -1 means do not delete, defaults to -1
        delErrMsgCooldown: -1,
        
        // What language your bot should use
        // Must be supported in your messages.json file
        defaultLangauge: 'english',
        
        // If your commands should not be ran by a bot, default false
        ignoreBots: true,
        
        // If interactions should only be shown to the one user
        // Only used for when WOKCommands sends an interaction response
        // Default is true
        ephemeral: true,
        
        // Various options for your MongoDB database connection
        dbOptions: {
            // These are the default options
            keepAlive: true
        },
        
        // What server/guild IDs are used for testing only commands & features
        // Can be a single string if there is only 1 ID
        testServers: ['899441191416901632', '581056239312568332'],
        
        // User your own ID
        // If you only have 1 ID then you can pass in a string instead
        botOwners: ['169978063478587392'],
        
        // What built-in commands should be disabled.
        // Note that you can overwrite a command as well by using
        // the same name as the command file name.
        disabledDefaultCommands: [
            // 'help',
            // 'command',
            // 'language',
            // 'prefix',
            // 'requiredrole',
            // 'channelonly'
        ],
        
        // Provides additional debug logging
        debug: false
    })
        // Here are some additional methods that you can chain
        // onto the contrustor call. These will eventually be
        // merged into the above object, but for now you can
        // use them:
        
        // The default is /
        .setDefaultPrefix('/')
        
        // Used for the color of embeds sent by WOKCommands
        .setColor(0xff0000)
})
  
DiscordClient.login('OTI1NjMyMjc0ODUzMTM0NDA3.Ycv8Ow.4agIwwI5RMKAh4Cq1KoCekSQDcE')

// 
// Website Related
// 
const app = express();
app.use(express.urlencoded());
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.static(__dirname + '/assets'));

//
// Site Routes
//
var index = require('./routes/index');
app.use('/', index);

const knowledgebaseRoutes = require('./routes/knowledgebaseRoutes');
app.use(knowledgebaseRoutes);

const policyRoutes = require('./routes/policyRoutes');
app.use(policyRoutes);

// 
// Dashboard Routes
// 
const dashboardRoutes = require('./routes/dashboard/dashboard');
app.use(dashboardRoutes);

const dashEventRoutes = require('./routes/dashboard/events');
app.use(dashEventRoutes);

const dashRankRoutes = require('./routes/dashboard/ranks');
app.use(dashRankRoutes);

const dashKnowledgebaseRoutes = require('./routes/dashboard/knowledgebase');
app.use(dashKnowledgebaseRoutes);

const dashServersRoutes = require('./routes/dashboard/servers');
app.use(dashServersRoutes);


// 
// API
// 
require('./api/routes')(app);

//
// Controllers
//
const database = require('./controllers/databaseController'); // Database controller

//
// Application Boot
//
const port = process.env.PORT || config.port || 8080;
app.listen(port, async function() {
    console.log(`\n// ${package.name} v.${package.version}\nGitHub Repository: ${package.homepage}\nCreated By: ${package.author}`);
    console.log(`Site and API is listening to the port ${port}`);
});