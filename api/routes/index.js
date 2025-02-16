import announcementApiRoute from "./announcement.js";
import applicationApiRoute from "./application.js";
import discordApiRoute from "./discord.js";
import serverApiRoute from "./server.js";
import sessionApiRoute from "./session.js";
import userApiRoute from "./user.js";
import webApiRoute from "./web.js";
import filterApiRoute from "./filter.js";
import rankApiRoute from "./ranks.js";
import reportApiRoute from "./report.js";
import shopApiRoute from "./shopdirectory.js";
import vaultApiRoute from "./vault.js";
import bridgeApiRoute from "./bridge.js";
import voteApiRoute from "./vote.js";

export default (app, client, moment, config, db, features, lang) => {
  announcementApiRoute(app, config, db, features, lang);
  applicationApiRoute(app, config, db, features, lang);
  discordApiRoute(app, client, config, db, features, lang);
  serverApiRoute(app, config, db, features, lang);
  reportApiRoute(app, config, db, features, lang);
  sessionApiRoute(app, config, db, features, lang);
  userApiRoute(app, config, db, features, lang);
  webApiRoute(app, config, db, features, lang);
  rankApiRoute(app, config, db, features, lang);
  filterApiRoute(app, client, config, db, features, lang);
  shopApiRoute(app, config, db, features, lang);
  vaultApiRoute(app, config, db, features, lang);
  bridgeApiRoute(app, config, db, features, lang);
  voteApiRoute(app, config, db, features, lang);

  app.get("/api/heartbeat", async function (req, res) {
    return res.send({
      success: true,
      message: `OK`,
    });
  });
};
