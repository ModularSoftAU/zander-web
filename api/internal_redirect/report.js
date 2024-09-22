import { hasPermission, postAPIRequest } from "../common";

export default function reportRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/report";

  app.post(baseEndpoint + "/create", async function (req, res) {
    req.body.reporterUser = req.session.user.username;

    postAPIRequest(
      `${process.env.siteAddress}/api/report/create`,
      req.body,
      `${process.env.siteAddress}/report`,
      res
    );

    res.redirect(`${process.env.siteAddress}/`);

    return res;
  });
}
