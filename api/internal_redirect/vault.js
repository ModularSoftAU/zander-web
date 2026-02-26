import { hasPermission, postAPIRequest } from "../common.js";

export default function vaultRedirectRoute(app, config, lang, features) {
  const baseEndpoint = "/redirect/vault";

  app.post(baseEndpoint + "/create", async function (req, res) {
    if (!(await hasPermission("zander.web.vault", req, res, features))) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/vault/create`,
      req.body,
      `${process.env.siteAddress}/dashboard/vault`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/vault`); return; }
    }
    return;
  });

  app.post(baseEndpoint + "/edit", async function (req, res) {
    if (!(await hasPermission("zander.web.vault", req, res, features))) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/vault/edit`,
      req.body,
      `${process.env.siteAddress}/dashboard/vault`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/vault`); return; }
    }
    return;
  });

  app.post(baseEndpoint + "/delete", async function (req, res) {
    if (!(await hasPermission("zander.web.vault", req, res, features))) return;

    // Add userId to req.body
    req.body.actioningUser = req.session.user.userId;

    await postAPIRequest(
      `${process.env.siteAddress}/api/vault/delete`,
      req.body,
      `${process.env.siteAddress}/dashboard/vault`,
      res
    );

    if (!res.sent) {
      { res.redirect(`${process.env.siteAddress}/dashboard/vault`); return; }
    }
    return;
  });
}
