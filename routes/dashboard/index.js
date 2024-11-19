import dashboardSiteRoute from "./dashboard";
import dashboardServersSiteRoute from "./servers";
import dashboardApplicationsSiteRoute from "./applications";
import dashboardAnnouncementSiteRoute from "./announcement";
import dashboardFormsSiteRoute from "./forms";
import dashboardVaultSiteRoute from "./vault";

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
  dashboardFormsSiteRoute(app, fetch, config, db, features, lang);
  dashboardVaultSiteRoute(app, fetch, config, db, features, lang);
}
