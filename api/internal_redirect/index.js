import knowledgebaseRedirectRoute from './knowledgebase'
import applicationRedirectRoute from './application'
import serverRedirectRoute from './server'

export default (app, config) => {
    knowledgebaseRedirectRoute(app, config);
    applicationRedirectRoute(app, config);
    serverRedirectRoute(app, config);
}