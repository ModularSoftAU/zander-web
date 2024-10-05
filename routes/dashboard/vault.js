import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common";
import { getWebAnnouncement } from "../../controllers/announcementController";

export default function dashboardVaultSiteRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  //
  // Vault
  //
  app.get("/dashboard/vault", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.vault, req, res, features))
      return;

    if (!hasPermission("zander.web.vault", req, res, features)) return;

    const fetchURL = `${process.env.siteAddress}/api/vault/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("dashboard/vault/vault-list", {
      pageTitle: `Dashboard - Vault`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/vault/create", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.vault, req, res, features)) return;

    if (!hasPermission("zander.web.vault", req, res, features)) return;

    return res.view("dashboard/vault/vault-editor", {
      pageTitle: `Dashboard - Vault Creator`,
      config: config,
      type: "create",
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/dashboard/vault/edit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.vault, req, res, features)) return;

    if (!hasPermission("zander.web.vault", req, res, features)) return;

    const vaultId = req.query.vaultId;
    const fetchURL = `${process.env.siteAddress}/api/vault/get?id=${vaultId}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const vaultApiData = await response.json();

    return res.view("dashboard/vault/vault-editor", {
      pageTitle: `Dashboard - Vault Editor`,
      config: config,
      vaultApiData: vaultApiData.data[0],
      type: "edit",
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
