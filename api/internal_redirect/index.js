import knowledgebaseRedirectRoute from './knowledgebase'
import applicationRedirectRoute from './application'
import serverRedirectRoute from './server'
import reportRedirectRoute from './report'
// import sessionRedirectRoute from './session'

export default (app, config, lang) => {
    knowledgebaseRedirectRoute(app, config, lang);
    applicationRedirectRoute(app, config, lang);
    serverRedirectRoute(app, config, lang);
    reportRedirectRoute(app, config, lang);
    // sessionRedirectRoute(app, config, lang);
}