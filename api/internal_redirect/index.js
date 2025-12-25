import applicationRedirectRoute from "./application.js";
import serverRedirectRoute from "./server.js";
import webRedirectRoute from "./web.js";
import announcementsRedirectRoute from "./announcement.js";
import reportRedirectRoute from "./report.js";
import vaultRedirectRoute from "./vault.js";
import bridgeRedirectRoute from "./bridge.js";
import rankRedirectRoute from "./rank.js";
import schedulerRedirectRoute from "./scheduler.js";

export default (app, config, lang) => {
  applicationRedirectRoute(app, config, lang);
  serverRedirectRoute(app, config, lang);
  reportRedirectRoute(app, config, lang);
  webRedirectRoute(app, config, lang);
  announcementsRedirectRoute(app, config, lang);
  vaultRedirectRoute(app, config, lang);
  bridgeRedirectRoute(app, config, lang);
  rankRedirectRoute(app, config, lang);
  schedulerRedirectRoute(app, config, lang);
};
