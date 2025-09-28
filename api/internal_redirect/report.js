import { hasPermission, postAPIRequest } from "../common.js";

export default function reportRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/report";

  app.post(baseEndpoint + "/create", async function (req, res) {
    req.body.reporterUser = req.session.user.username;

    const result = await postAPIRequest(
      `${process.env.siteAddress}/api/report/create`,
      req.body,
      res
    );

    if (!result || result.success === false) {
      return res.redirect(`${process.env.siteAddress}/report`);
    }

    return res.redirect(`${process.env.siteAddress}/`);
  });
}
