import { getGlobalImage } from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import { UserGetter, getProfilePicture, getUserLastSession, getUserPermissions, getUserStats } from "../controllers/userController";

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

    try {
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
        // 
        // Grab user profile data
        // 
        const fetchURL = `${process.env.siteAddress}/api/user/get?username=${username}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });

        const profileApiData = await response.json();

        // 
        // Get user context for display permissions
        // 
        let contextPermissions = null;

        if (req.session.user) {
          const userProfile = await userData.byUsername(
            req.session.user.username
          );
          const perms = await getUserPermissions(userProfile);
          contextPermissions = perms;
        } else {
          contextPermissions = null;
        }

        // 
        // Render the profile page
        // 
        return res.view("modules/profile/profile", {
          pageTitle: `${profileApiData.data[0].username}`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          profilePicture: await getProfilePicture(
            profileApiData.data[0].username
          ),
          profileApiData: profileApiData.data[0],
          profileStats: await getUserStats(profileApiData.data[0].userId),
          profileSession: await getUserLastSession(profileApiData.data[0].userId),
          moment: moment,
          contextPermissions: contextPermissions,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });


  //
  // Edit Signed in User profile
  //
  app.get("/profile/:username/edit", async function (req, res) {
    const username = req.params.username;

    try {
      const userData = new UserGetter();
      const userHasJoined = await userData.hasJoined(username);

      if (!userHasJoined) {
        return res.view("session/notFound", {
          pageTitle: `404: Player Not Found`,
          config: config,
          req: req,
          res: res,
          features: features,
          profileSession: await getUserLastSession(profileApiData.data[0].userId),
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      } else {
        //
        // Grab user profile data
        //
        const fetchURL = `${process.env.siteAddress}/api/user/get?username=${req.session.user.username}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });

        const profileApiData = await response.json();

        //
        // Render the profile page
        //
        return res.view("modules/profile/profileEditor", {
          pageTitle: `${profileApiData.data[0].username} - Profile Editor`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          profilePicture: await getProfilePicture(profileApiData.data[0].username),
          profileApiData: profileApiData.data[0],
          profileStats: await getUserStats(profileApiData.data[0].userId),
          moment: moment,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });
}
