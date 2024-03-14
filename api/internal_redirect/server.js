import { hasPermission, postAPIRequest } from "../common";

export default function serverRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/server";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.server", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/server/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/servers`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/servers`);

    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.server", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/server/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/servers`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/servers`);

    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.server", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/server/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/servers`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/servers`);

    return res;
  });
}
