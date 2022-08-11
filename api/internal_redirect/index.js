import knowledgebaseRedirectRoute from './knowledgebase'
import applicationRedirectRoute from './application'
import serverRedirectRoute from './server'
import reportRedirectRoute from './report'
import webRedirectRoute from './web'
import announcementsRedirectRoute from './announcement'

export default (app, config, lang) => {
    knowledgebaseRedirectRoute(app, config, lang);
    applicationRedirectRoute(app, config, lang);
    serverRedirectRoute(app, config, lang);
    reportRedirectRoute(app, config, lang);
    webRedirectRoute(app, config, lang);
    announcementsRedirectRoute(app, config, lang);
}