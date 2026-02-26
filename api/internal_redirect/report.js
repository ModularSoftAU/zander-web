import { postAPIRequest } from "../common.js";

export default function reportRedirectRoute(app, config, lang, features) {
  const baseEndpoint = "/redirect/report";

  app.post(baseEndpoint + "/create", async function (req, res) {
    req.body.reporterUser = req.session.user.username;

    await postAPIRequest(
      `${process.env.siteAddress}/api/report/create`,
      req.body,
      `${process.env.siteAddress}/report`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/`); return; };
    }
    return;
  });
}
