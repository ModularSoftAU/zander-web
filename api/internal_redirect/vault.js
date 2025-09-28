import { hasPermission, postAPIRequest } from "../common.js";

export default function vaultRedirectRoute(app, config, lang) {
  const baseEndpoint = "/redirect/vault";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!hasPermission("zander.web.vault", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/vault/create`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/vault`);
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!hasPermission("zander.web.vault", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/vault/edit`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/vault`);
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!hasPermission("zander.web.vault", req, res)) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/vault/delete`,
      req.body,
      res
    );

    return res.redirect(`${process.env.siteAddress}/dashboard/vault`);
  });
}
