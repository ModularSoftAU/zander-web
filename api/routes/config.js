export default async function configApiRoute(app, config, db, features, lang) {
  app.get("/policy", async function (req, res) {
    // There is no isFeatureEnabled() due to being a critical endpoint.

    return res.send({
      success: true,
      data: config.siteConfiguration.policy,
    });
  });

  app.get("/social", async function (req, res) {
    const platforms = config.siteConfiguration.platforms;
    const socialMedia = {};

    const socialMapping = {
      smDiscord: "discord",
      smFacebook: "facebook",
      smTwitter: "twitter",
      smInstagram: "instagram",
      smReddit: "reddit",
      smTwitch: "twitch",
      smYouTube: "youtube",
      smLinkedIn: "linkedin",
      smTikTok: "tiktok",
    };

    for (const [feature, platform] of Object.entries(socialMapping)) {
      if (features[feature]) {
        socialMedia[platform] = platforms[platform];
      }
    }

    return res.send({
      success: true,
      data: socialMedia,
    });
  });
}
