import applicationRedirectRoute from "./application";
import serverRedirectRoute from "./server";
import webRedirectRoute from "./web";
import announcementsRedirectRoute from "./announcement";
import reportRedirectRoute from "./report";

export default (app, config, lang) => {
  applicationRedirectRoute(app, config, lang);
  serverRedirectRoute(app, config, lang);
  reportRedirectRoute(app, config, lang);
  webRedirectRoute(app, config, lang);
  announcementsRedirectRoute(app, config, lang);
};
