import dashboardSiteRoute from './dashboard'
import dashboardEventSiteRoute from './events'
import dashboardKnowledgebaseSiteRoute from './knowledgebase'
import dashboardRanksSiteRoute from './ranks'
import dashboardServersSiteRoute from './servers'
import dashboardApplicationsSiteRoute from './applications'

export default function dashbordSiteRoutes(app, fetch, moment, config, db, features) {
  
    dashboardSiteRoute(app, config, features);
    dashboardEventSiteRoute(app, fetch, moment, config, db, features);
    dashboardKnowledgebaseSiteRoute(app, fetch, moment, config, db, features);
    dashboardRanksSiteRoute(app, fetch, config, features);
    dashboardServersSiteRoute(app, fetch, config, db, features);
    dashboardApplicationsSiteRoute(app, fetch, config, db, features);

}