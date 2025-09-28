import { postAPIRequest } from "../common.js";

export default function webRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/web";

  app.post(baseEndpoint + "/user/link", async function (req, res) {
    const result = await postAPIRequest(
      `${process.env.siteAddress}/api/user/link`,
      req.body,
      res
    );

    if (!result || result.success === false) {
      return res.redirect(`${process.env.siteAddress}/unregistered`);
    }

    return res.redirect(`${process.env.siteAddress}/`);
  });

  app.post(baseEndpoint + "/user/profile/display", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    // Make the API request
    const result = await postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/display`,
      req.body,
      res
    );

    if (!result || result.success === false) {
      return res.redirect(`${process.env.siteAddress}/`);
    }

    return res.redirect(
      `${process.env.siteAddress}/profile/${req.session.user.username}`
    );
  });

  app.post(baseEndpoint + "/user/profile/interests", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    const result = await postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/interests`,
      req.body,
      res
    );

    if (!result || result.success === false) {
      return res.redirect(`${process.env.siteAddress}/`);
    }

    return res.redirect(
      `${process.env.siteAddress}/profile/${req.session.user.username}`
    );
  });

  app.post(baseEndpoint + "/user/profile/about", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    const result = await postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/about`,
      req.body,
      res
    );

    if (!result || result.success === false) {
      return res.redirect(`${process.env.siteAddress}/`);
    }

    return res.redirect(
      `${process.env.siteAddress}/profile/${req.session.user.username}`
    );
  });

  app.post(baseEndpoint + "/user/profile/social", async function (req, res) {
    // Add userId to req.body
    req.body.userId = req.session.user.userId;

    const result = await postAPIRequest(
      `${process.env.siteAddress}/api/user/profile/social`,
      req.body,
      res
    );

    if (!result || result.success === false) {
      return res.redirect(`${process.env.siteAddress}/`);
    }

    return res.redirect(
      `${process.env.siteAddress}/profile/${req.session.user.username}`
    );
  });
}
