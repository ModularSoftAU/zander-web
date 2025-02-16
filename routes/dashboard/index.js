import dashboardSiteRoute from "./dashboard.js";
import dashboardServersSiteRoute from "./servers.js";
import dashboardApplicationsSiteRoute from "./applications.js";
import dashboardAnnouncementSiteRoute from "./announcement.js";
import dashboardVaultSiteRoute from "./vault.js";
import dashboardVoteSiteRoute from "./vote.js";

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
  dashboardVaultSiteRoute(app, fetch, config, db, features, lang);
  dashboardVoteSiteRoute(app, fetch, config, db, features, lang);
}
