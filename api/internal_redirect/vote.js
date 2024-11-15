import { hasPermission, postAPIRequest } from "../common";

export default function voteRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/vote";

  app.post(baseEndpoint + "/cast", async function (req, res) {
    if (!hasPermission("zander.web.vote", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vote/cast`,
      req.body,
      `${process.env.siteAddress}/dashboard/vote`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vote`);

    return res;
  });

  app.post(baseEndpoint + "/site/create", async function (req, res) {
    if (!hasPermission("zander.web.vote", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vote/site/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/vote`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vote`);

    return res;
  });

  app.post(baseEndpoint + "/site/edit", async function (req, res) {
    if (!hasPermission("zander.web.vote", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vote/site/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/vote`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vote`);

    return res;
  });

  app.post(baseEndpoint + "/site/delete", async function (req, res) {
    if (!hasPermission("zander.web.vote", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vote/site/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/vote`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vote`);

    return res;
  });
}
