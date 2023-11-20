import announcementApiRoute from "./announcement";
import applicationApiRoute from "./application";
import discordApiRoute from "./discord";
import serverApiRoute from "./server";
import sessionApiRoute from "./session";
import userApiRoute from "./user";
import webApiRoute from "./web";
import filterApiRoute from "./filter";

export default (app, client, moment, config, db, features, lang) => {
  announcementApiRoute(app, config, db, features, lang);
  applicationApiRoute(app, config, db, features, lang);
  discordApiRoute(app, client, config, db, features, lang);
  serverApiRoute(app, config, db, features, lang);
  sessionApiRoute(app, config, db, features, lang);
  userApiRoute(app, config, db, features, lang);
  webApiRoute(app, config, db, features, lang);
  filterApiRoute(app, config, db, features, lang);

  app.get("/api/heartbeat", async function (req, res) {
    return res.send({
      success: true,
      message: `OK`,
    });
  });
};
