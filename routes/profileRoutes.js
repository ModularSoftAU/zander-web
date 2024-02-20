import { isFeatureWebRouteEnabled, getGlobalImage, hasPermission } from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import { UserGetter, getProfilePicture, getUserPermissions } from "../controllers/userController";

export default function profileSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  // 
  // View User Profile
  // 
  app.get("/profile/:username", async function (req, res) {
    const username = req.params.username;

    const userData = new UserGetter();
    const userHasJoined = await userData.hasJoined(username);

    if (!userHasJoined) {
      return res.view("session/notFound", {
        pageTitle: `404: Player Not Found`,
        config: config,
        req: req,
        res: res,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    } else {
      const fetchURL = `${process.env.siteAddress}/api/user/get?username=${username}`;
      const response = await fetch(fetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const profileApiData = await response.json();

      console.log(profileApiData);

      const [profilePicture] = await Promise.all([getProfilePicture(username)]);
      
      const perms = await getUserPermissions(profileApiData.data[0]);

      const filteredArray = perms.filter((item) =>
        item.includes("zander.web.logs")
      );

      console.log(filteredArray);

      return res.view("modules/profile/profile", {
        pageTitle: `${profileApiData.data[0].username}`,
        config: config,
        req: req,
        features: features,
        globalImage: await getGlobalImage(),
        profileApiData: profileApiData.data[0],
        announcementWeb: await getWebAnnouncement(),
        profilePicture: profilePicture,
        moment: moment,
      });
    }
  });

  //
  // Edit Signed in User profile
  //
  app.get("/profile/user/edit", async function (req, res) {
    isFeatureWebRouteEnabled(features.server, req, res, features);

    const fetchURL = `${process.env.siteAddress}/api/server/get?visible=true`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("modules/play/play", {
      pageTitle: `Play`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });
}
