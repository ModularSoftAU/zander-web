import { hasPermission, postAPIRequest } from "../common.js";

export default function serverRedirectRoute(app, config, lang, features) {
  const baseEndpoint = "/redirect/server";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!(await hasPermission("zander.web.server", req, res, features))) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/server/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/servers`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/servers`); return; };
    }
    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!(await hasPermission("zander.web.server", req, res, features))) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/server/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/servers`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/servers`); return; };
    }
    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!(await hasPermission("zander.web.server", req, res, features))) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/server/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/servers`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/servers`); return; };
    }
    return res;
  });
}
