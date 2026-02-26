import { hasPermission, postAPIRequest } from "../common.js";

export default function schedulerRedirectRoute(app, config, lang, features) {
  const baseEndpoint = "/redirect/scheduler";

  app.post(baseEndpoint + "/discord/create", async function (req, res) {
    if (!(await hasPermission("zander.web.scheduler", req, res, features))) return;

    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/scheduler/discord/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/scheduler`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/scheduler`); return; }
    }
    return;
  });

  app.post(baseEndpoint + "/discord/delete", async function (req, res) {
    if (!(await hasPermission("zander.web.scheduler", req, res, features))) return;

    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/scheduler/discord/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/scheduler`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/scheduler`); return; }
    }
    return;
  });
}
