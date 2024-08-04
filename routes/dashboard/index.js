import dashboardSiteRoute from "./dashboard";
import dashboardServersSiteRoute from "./servers";
import dashboardApplicationsSiteRoute from "./applications";
import dashboardAnnouncementSiteRoute from "./announcement";

export default function dashboardSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  dashboardSiteRoute(app, config, features, lang);
  dashboardServersSiteRoute(app, fetch, config, db, features, lang);
  dashboardAnnouncementSiteRoute(app, fetch, config, db, features, lang);
  dashboardApplicationsSiteRoute(app, fetch, config, db, features, lang);
}
