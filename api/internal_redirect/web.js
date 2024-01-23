import { postAPIRequest } from "../common";

export default function webRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/web";

  app.post(baseEndpoint + "/register", async function (req, res) {
    await postAPIRequest(
      `${process.env.siteAddress}/api/web/register/create`,
      req.body,
      `${process.env.siteAddress}/register`,
      res
    );

    res.redirect(`${process.env.siteAddress}/register`);

    return res;
  });

  app.post(baseEndpoint + "/verify/email", async function (req, res) {
    await postAPIRequest(
      `${process.env.siteAddress}/api/web/verify/email`,
      req.body,
      `${process.env.siteAddress}/verify/email`,
      res
    );

    res.redirect(`${process.env.siteAddress}/`);

    return res;
  });

  app.post(baseEndpoint + "/verify/minecraft", async function (req, res) {
    await postAPIRequest(
      `${process.env.siteAddress}/api/web/verify/minecraft`,
      req.body,
      `${process.env.siteAddress}/verify/minecraft`,
      res
    );

    res.redirect(`${process.env.siteAddress}/`);

    return res;
  });
}
