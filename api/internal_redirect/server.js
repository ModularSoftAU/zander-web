import { hasPermission, postAPIRequest } from "../common.js";

export default function serverRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/server";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.server", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/server/create`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/servers`);
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.server", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/server/edit`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/servers`);
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.server", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/server/delete`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/servers`);
  });
}
