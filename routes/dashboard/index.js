import dashboardSiteRoute from './dashboard'
import dashboardEventSiteRoute from './events'
import dashboardKnowledgebaseSiteRoute from './knowledgebase'
import dashboardRanksSiteRoute from './ranks'
import dashboardServersSiteRoute from './servers'
import dashboardApplicationsSiteRoute from './applications'

export default function dashbordSiteRoutes(app, fetch, moment, config, db) {
  
    dashboardSiteRoute(app, config);
    dashboardEventSiteRoute(app, fetch, moment, config, db);
    dashboardKnowledgebaseSiteRoute(app, fetch, moment, config, db);
    dashboardRanksSiteRoute(app, fetch, config);
    dashboardServersSiteRoute(app, fetch, config, db);
    dashboardApplicationsSiteRoute(app, fetch, config, db);

}