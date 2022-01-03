import alertApiRoute from './alert'
import anticheatApiRoute from './anticheat'
import appealApiRoute from './appeal'
import applicationApiRoute from './application'
import communityCreationApiRoute from './communitycreation'
import discordApiRoute from './discord'
import eventApiRoute from './event'
import friendApiRoute from './friend'
import knowledgebaseApiRoute from './knowledgebase'
import punishmentApiRoute from './punishment'
import rankApiRoute from './rank'
import reportApiRoute from './report'
import serverApiRoute from './server'
import sessionApiRoute from './session'
import shoppingDistrictDirectoryApiRoute from './shoppingdistrictdirectory'
import userApiRoute from './user'
import voteApiRoute from './vote'
import webApiRoute from './web'

export default (app, DiscordClient, moment) => {

    alertApiRoute(app);
    anticheatApiRoute(app);
    appealApiRoute(app);
    applicationApiRoute(app);
    communityCreationApiRoute(app);
    discordApiRoute(app, DiscordClient);
    eventApiRoute(app, DiscordClient, moment);
    friendApiRoute(app);
    knowledgebaseApiRoute(app);
    punishmentApiRoute(app);
    rankApiRoute(app);
    reportApiRoute(app);
    serverApiRoute(app);
    sessionApiRoute(app);
    shoppingDistrictDirectoryApiRoute(app);
    userApiRoute(app);
    voteApiRoute(app);
    webApiRoute(app);

    // require('./alert')(app);
    // require('./anticheat')(app);
    // require('./appeal')(app);
    // require('./application')(app);
    // require('./communitycreation')(app);
    // require('./discord')(app, DiscordClient);
    // require('./event')(app, DiscordClient, moment);
    // require('./friend')(app);
    // require('./knowledgebase')(app);
    // require('./punishment')(app);
    // require('./rank')(app);
    // require('./report')(app);
    // require('./server')(app);
    // require('./session')(app);
    // require('./shoppingdistrictdirectory')(app);
    // require('./user')(app);
    // require('./vote')(app);
    // require('./web')(app);

}