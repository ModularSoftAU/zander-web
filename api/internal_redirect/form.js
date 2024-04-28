import { hasPermission, postAPIRequest } from "../common";

export default function formRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/form";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.form", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    console.log(req.body);

    postAPIRequest(
      `${process.env.siteAddress}/api/form/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);

    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.form", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/form/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);

    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.form", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/form/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/forms`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/forms`);

    return res;
  });
}
