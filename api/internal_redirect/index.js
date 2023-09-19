import applicationRedirectRoute from './application'
import serverRedirectRoute from './server'
import eventRedirectRoute from './event'
import webRedirectRoute from './web'
import announcementsRedirectRoute from './announcement'
import userRedirectRoute from './user'

export default (app, config, lang) => {
    applicationRedirectRoute(app, config, lang);
    serverRedirectRoute(app, config, lang);
    eventRedirectRoute(app, config, lang);
    webRedirectRoute(app, config, lang);
    announcementsRedirectRoute(app, config, lang);
    userRedirectRoute(app, config, lang);
}