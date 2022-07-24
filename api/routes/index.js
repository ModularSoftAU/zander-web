import announcementApiRoute from './announcement'
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
import filterApiRoute from './filter'

export default (app, client, moment, config, db, features, lang) => {

    announcementApiRoute(app, config, db, features, lang);
    appealApiRoute(app, config, db, features, lang);
    applicationApiRoute(app, config, db, features, lang);
    communityCreationApiRoute(app, config, db, features, lang);
    discordApiRoute(app, client, config, db, features, lang);
    eventApiRoute(app, client, moment, config, db, features, lang);
    friendApiRoute(app, config, db, features, lang);
    knowledgebaseApiRoute(app, config, db, features, lang);
    punishmentApiRoute(app, config, db, features, lang);
    rankApiRoute(app, config, db, features, lang);
    reportApiRoute(app, client, config, db, features, lang);
    serverApiRoute(app, config, db, features, lang);
    sessionApiRoute(app, config, db, features, lang);
    shoppingDistrictDirectoryApiRoute(app, config, db, features, lang);
    userApiRoute(app, config, db, features, lang);
    voteApiRoute(app, config, db, features, lang);
    webApiRoute(app, config, db, features, lang);
    filterApiRoute(app, config, db, features, lang);   

}