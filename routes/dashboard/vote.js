import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common";
import { getWebAnnouncement } from "../../controllers/announcementController";

export default function dashboardVoteSiteRoute(
  app,
  fetch,
  config,
  db,
  features,
  lang
) {
  //
  // Vote
  //
  app.get("/dashboard/vote", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.vote, req, res, features)) return;

    if (!hasPermission("zander.web.vote", req, res, features)) return;

    const fetchURL = `${process.env.siteAddress}/api/vote/site/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    res.view("dashboard/vote/vote-list", {
      pageTitle: `Dashboard - Vote`,
      config: config,
      apiData: apiData,
      features: features,
      req: req,
      globalImage: getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/dashboard/vote/site/create", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.vote, req, res, features)) return;

    if (!hasPermission("zander.web.vote", req, res, features)) return;

    res.view("dashboard/vote/vote-editor", {
      pageTitle: `Dashboard - Vote Creator`,
      config: config,
      type: "create",
      features: features,
      globalImage: getGlobalImage(),
      req: req,
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/dashboard/vote/edit", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.vote, req, res, features)) return;

    if (!hasPermission("zander.web.vote", req, res, features)) return;

    const id = req.query.id;
    const fetchURL = `${process.env.siteAddress}/api/vote/get?id=${id}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const voteApiData = await response.json();

    res.view("dashboard/vote/vote-editor", {
      pageTitle: `Dashboard - Vote Editor`,
      config: config,
      voteApiData: voteApiData.data[0],
      type: "edit",
      features: features,
      globalImage: getGlobalImage(),
      req: req,
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });
}
