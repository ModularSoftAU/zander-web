export default function redirectSiteRoutes(app, config, featuress) {
  //
  // Discord Redirect
  //
  app.get("/discord", async function (req, res) {
    { res.redirect(config.siteConfiguration.platforms.discord); return; }
  });

  //
  // Webstore Redirect
  //
  app.get("/webstore", async function (req, res) {
    { res.redirect(config.siteConfiguration.platforms.webstore); return; }
  });

  //
  // Guides Redirect
  //
  app.get("/knowledgebase", async function (req, res) {
    { res.redirect(config.siteConfiguration.platforms.knowledgebase); return; }
  });

  //
  // Issue Tracker Redirect
  //
  app.get("/issues", async function (req, res) {
    { res.redirect(config.siteConfiguration.platforms.issueTracker); return; }
  });
}
