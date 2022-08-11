import dashboardSiteRoute from './dashboard'
import dashboardEventSiteRoute from './events'
import dashboardKnowledgebaseSiteRoute from './knowledgebase'
import dashboardRanksSiteRoute from './ranks'
import dashboardServersSiteRoute from './servers'
import dashboardApplicationsSiteRoute from './applications'
import dashboardAnnouncementSiteRoute from './announcement'

export default function dashbordSiteRoutes(app, client, fetch, moment, config, db, features, lang) {
  
    dashboardSiteRoute(app, config, features, lang);
    dashboardEventSiteRoute(app, client, fetch, moment, config, db, features, lang);
    dashboardKnowledgebaseSiteRoute(app, fetch, moment, config, db, features, lang);
    dashboardRanksSiteRoute(app, fetch, config, features, lang);
    dashboardServersSiteRoute(app, fetch, config, db, features, lang);
    dashboardAnnouncementSiteRoute(app, fetch, config, db, features, lang);
    dashboardApplicationsSiteRoute(app, fetch, config, db, features, lang);

}