import dashboardSiteRoute from "./dashboard.js";
import dashboardServersSiteRoute from "./servers.js";
import dashboardApplicationsSiteRoute from "./applications.js";
import dashboardAnnouncementSiteRoute from "./announcement.js";
import dashboardVaultSiteRoute from "./vault.js";
import dashboardRanksSiteRoute from "./ranks.js";
import dashboardForumsSiteRoute from "./forums.js";
import supportDashboardRoutes from "./support.js";
import dashboardSchedulerSiteRoute from "./scheduler.js";
import dashboardWebPunishmentsRoute from "./webPunishments.js";
import dashboardVotingRoute from "./voting.js";
import dashboardEventsRoute from "./events.js";

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
  supportDashboardRoutes(app, client, fetch, moment, config, db, features, lang);
  dashboardSiteRoute(app, config, features, lang);
  dashboardServersSiteRoute(app, fetch, config, db, features, lang);
  dashboardAnnouncementSiteRoute(app, fetch, config, db, features, lang);
  dashboardApplicationsSiteRoute(app, fetch, config, db, features, lang);
  dashboardVaultSiteRoute(app, fetch, config, db, features, lang);
  dashboardRanksSiteRoute(app, fetch, config, db, features, lang);
  dashboardForumsSiteRoute(app, fetch, config, db, features, lang);
  dashboardSchedulerSiteRoute(app, client, fetch, config, features, lang);
  dashboardWebPunishmentsRoute(app, client, fetch, config, db, features, lang);
  dashboardVotingRoute(app, fetch, config, db, features, lang);
  dashboardEventsRoute(app, fetch, config, db, features, lang);
}
