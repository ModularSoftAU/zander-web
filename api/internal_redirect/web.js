import { postAPIRequest } from "../common";

export default function webRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/web";

  app.post(baseEndpoint + "/user/link", async function (req, res) {
    postAPIRequest(
      `${process.env.siteAddress}/api/user/link`,
      req.body,
      `${process.env.siteAddress}/`,
      res
    );

    res.redirect(`${process.env.siteAddress}/`);

    return res;
  });
}
