import { hasPermission, postAPIRequest } from "../common.js";

export default function applicationRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/applications";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.application", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/application/create`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.application", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/application/edit`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.application", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/application/delete`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/applications`);
  });
}
