import { hasPermission, postAPIRequest } from "../common.js";

export default function bridgeRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/bridge";

  app.post(baseEndpoint + "/action/add", async function (req, res) {
    if (!hasPermission("zander.web.bridge", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/bridge/action/add`,
      req.body,
      `${process.env.siteAddress}/dashboard/bridge`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/bridge`);

    return res;
  });
}
