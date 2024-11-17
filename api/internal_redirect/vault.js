import { hasPermission, postAPIRequest } from "../common";

export default function vaultRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/vault";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.vault", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vault/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/vault`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vault`);

    return res;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.vault", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vault/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/vault`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vault`);

    return res;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.vault", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    postAPIRequest(
      `${process.env.siteAddress}/api/vault/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/vault`,
      res
    );

    res.redirect(`${process.env.siteAddress}/dashboard/vault`);

    return res;
  });
}
