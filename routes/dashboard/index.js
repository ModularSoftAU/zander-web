import dashboardSiteRoute from './dashboard'
import dashboardEventSiteRoute from './events'
import dashboardKnowledgebaseSiteRoute from './knowledgebase'
import dashboardRanksSiteRoute from './ranks'
import dashboardServersSiteRoute from './servers'

export default function dashbordSiteRoutes(app, fetch, moment, config) {

    dashboardSiteRoute(app, config);
    dashboardEventSiteRoute(app, fetch, moment, config);
    dashboardKnowledgebaseSiteRoute(app, fetch, moment, config);
    dashboardRanksSiteRoute(app, fetch, config);
    dashboardServersSiteRoute(app, fetch, config);

}