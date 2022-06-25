import knowledgebaseRedirectRoute from './knowledgebase'
import applicationRedirectRoute from './application'
import serverRedirectRoute from './server'
import reportRedirectRoute from './report'
import webRedirectRoute from './web'

export default (app, config) => {
    knowledgebaseRedirectRoute(app, config);
    applicationRedirectRoute(app, config);
    serverRedirectRoute(app, config);
    reportRedirectRoute(app, config);
    webRedirectRoute(app, config);
}