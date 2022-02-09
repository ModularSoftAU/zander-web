import announcementApiRoute from './announcement'
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

export default (app, DiscordClient, moment, config, db) => {

    announcementApiRoute(app, config, db);
    anticheatApiRoute(app, config, db);
    appealApiRoute(app, config, db);
    applicationApiRoute(app, config, db);
    communityCreationApiRoute(app, config, db);
    discordApiRoute(app, DiscordClient, config, db);
    eventApiRoute(app, DiscordClient, moment, config, db);
    friendApiRoute(app, config, db);
    knowledgebaseApiRoute(app, config, db);
    punishmentApiRoute(app, config, db);
    rankApiRoute(app, config, db);
    reportApiRoute(app, config, db);
    serverApiRoute(app, config, db);
    sessionApiRoute(app, config, db);
    shoppingDistrictDirectoryApiRoute(app, config, db);
    userApiRoute(app, config, db);
    voteApiRoute(app, config, db);
    webApiRoute(app, config, db);

}