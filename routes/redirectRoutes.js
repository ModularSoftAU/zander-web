export default function redirectSiteRoutes(app, config, featuress) {
  //
  // Discord Redirect
  //
  app.get("/discord", async function (req, res) {
    return res.redirect(config.siteConfiguration.platforms.discord);
  });

  //
  // Webstore Redirect
  //
  app.get("/webstore", async function (req, res) {
    return res.redirect(config.siteConfiguration.platforms.webstore);
  });

  //
  // Guides Redirect
  //
  app.get("/knowledgebase", async function (req, res) {
    return res.redirect(config.siteConfiguration.platforms.knowledgebase);
  });

  //
  // Issue Tracker Redirect
  //
  app.get("/issues", async function (req, res) {
    return res.redirect(config.siteConfiguration.platforms.issueTracker);
  });
}
