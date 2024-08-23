import { hasPermission, postAPIRequest } from "../common";

export default function announcementRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/announcement";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.announcements", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/announcement/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/announcements`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/announcements`);

    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.announcements", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/announcement/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/announcements`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/announcements`);

    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.announcements", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/announcement/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/announcements`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/announcements`);

    return res;
  });
}
