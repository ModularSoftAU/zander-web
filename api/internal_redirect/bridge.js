import { hasPermission, postAPIRequest } from "../common.js";

export default function bridgeRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/bridge";

  app.post(baseEndpoint + "/command/add", async function (req, res) {
    if (!hasPermission("zander.web.bridge", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/bridge/command/add`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/bridge`);
  });
}
