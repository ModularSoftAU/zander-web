module.exports = (app, DiscordClient, moment) => {

    require('./alert')(app);
    require('./anticheat')(app);
    require('./appeal')(app);
    require('./application')(app);
    require('./communitycreation')(app);
    require('./discord')(app, DiscordClient);
    require('./event')(app, DiscordClient, moment);
    require('./friend')(app);
    require('./knowledgebase')(app);
    require('./punishment')(app);
    require('./rank')(app);
    require('./report')(app);
    require('./server')(app);
    require('./session')(app);
    require('./shoppingdistrictdirectory')(app);
    require('./user')(app);
    require('./vote')(app);
    require('./web')(app);

}