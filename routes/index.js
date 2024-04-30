import dashboardSiteRoutes from "./dashboard";
import policySiteRoutes from "./policyRoutes";
import sessionRoutes from "./sessionRoutes";
import { isFeatureWebRouteEnabled, getGlobalImage, isLoggedIn } from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import redirectSiteRoutes from "./redirectRoutes";
import rankData from "../ranks.json" assert { type: "json" };
import profileSiteRoutes from "./profileRoutes";

export default function applicationSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  dashboardSiteRoutes(app, client, fetch, moment, config, db, features, lang);
  sessionRoutes(app, client, fetch, moment, config, db, features, lang);
  profileSiteRoutes(app, client, fetch, moment, config, db, features, lang);
  policySiteRoutes(app, config, features);
  redirectSiteRoutes(app, config, features);

  app.get("/", async function (req, res) {
    const fetchURL = `${process.env.siteAddress}/api/web/statistics`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const statApiData = await response.json();

    return res.view("modules/index/index", {
      pageTitle: `${config.siteConfiguration.siteName}`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      statApiData: statApiData,
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Play
  //
  app.get("/play", async function (req, res) {
    isFeatureWebRouteEnabled(features.server, req, res, features);

    const fetchURL = `${process.env.siteAddress}/api/server/get?type=EXTERNAL`;
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

  //
  // Apply
  //
  app.get("/apply", async function (req, res) {
    isFeatureWebRouteEnabled(features.applications, req, res, features);

    const fetchURL = `${process.env.siteAddress}/api/application/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    return res.view("apply", {
      pageTitle: `Apply`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  //
  // Ranks
  //
  app.get("/ranks", async function (req, res) {
    isFeatureWebRouteEnabled(features.ranks, req, res, features);

    return res.view("ranks", {
      pageTitle: `Ranks`,
      config: config,
      req: req,
      rankData: rankData.categories,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/form/:formSlug", async function (req, res) {
    const formSlug = req.params.formSlug;

    try {
      if (!isLoggedIn(req) || !req.session.user) {
        return res.view("session/notLoggedIn", {
          pageTitle: `Not Logged in`,
          config: config,
          req: req,
          res: res,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      } else {
        //
        // Grab form data
        //
        const fetchURL = `${process.env.siteAddress}/api/form/get?slug=${formSlug}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });

        const formApiData = await response.json();
        let formSchemaData = null;

        if (formApiData.data[0].formSchema) {
          //
          // Grab form schema data
          //
          const schemaFetchURL = `${formApiData.data[0].formSchema}`;
          const schemaResponse = await fetch(schemaFetchURL);
          const formSchemaJSONData = await schemaResponse.json();

          formSchemaData = formSchemaJSONData;
        }

        //
        // Render the form page
        //
        return res.view("form", {
          pageTitle: formApiData.data[0].displayName,
          config: config,
          req: req,
          features: features,
          formApiData: formApiData,
          formSchemaData: formSchemaData,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          moment: moment,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });
}
