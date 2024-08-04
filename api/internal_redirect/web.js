import { postAPIRequest } from "../common";

export default function webRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/web";

  app.post(baseEndpoint + "/user/link", async function (req, res) {
    postAPIRequest(
      `${process.env.siteAddress}/api/user/link`,
      req.body,
      `${process.env.siteAddress}/unregistered`,
      res
    );

    res.redirect(`${process.env.siteAddress}/`);

    return res;
  });

  app.post(baseEndpoint + "/user/profile/display", async function (req, res) {    
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    // Make the API request
    postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/display`,
      req.body,
      `${process.env.siteAddress}/`,
      res
    );

    res.redirect(`${process.env.siteAddress}/profile/${req.session.user.username}`);

    return res;
  });

  app.post(baseEndpoint + "/user/profile/interests", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/interests`,
      req.body,
      `${process.env.siteAddress}/`,
      res
    );

    res.redirect(`${process.env.siteAddress}/profile/${req.session.user.username}`);

    return res;
  });

  app.post(baseEndpoint + "/user/profile/about", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/about`,
      req.body,
      `${process.env.siteAddress}/`,
      res
    );

    res.redirect(`${process.env.siteAddress}/profile/${req.session.user.username}`);

    return res;
  });

  app.post(baseEndpoint + "/user/profile/social", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;
    
    postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/social`,
      req.body,
      `${process.env.siteAddress}/`,
      res
    );

    res.redirect(`${process.env.siteAddress}/profile/${req.session.user.username}`);

    return res;
  });
}
