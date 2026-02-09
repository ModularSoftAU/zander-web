export default async function configApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/config";

  app.get(baseEndpoint + "/policy", async function (req, res) {
    // There is no isFeatureEnabled() due to being a critical endpoint.

    return res.send({
      success: true,
      data: config.siteConfiguration.policy,
    });
  });
}
