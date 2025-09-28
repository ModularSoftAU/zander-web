import { hasPermission, postAPIRequest } from "../common.js";

export default function announcementRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/announcement";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.announcements", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/announcement/create`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.announcements", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/announcement/edit`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.announcements", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/announcement/delete`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
  });
}
