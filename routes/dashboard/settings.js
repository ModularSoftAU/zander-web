import { hasPermission } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEATURES_PATH = path.resolve(__dirname, "../../features.json");

export default function dashboardSettingsRoute(app, config, features, lang) {
  app.get("/dashboard/settings", async function (req, res) {
    if (!await hasPermission("zander.web.settings", req, res, features)) return;

    const announcementWeb = await getWebAnnouncement();

    res.header("content-type", "text/html; charset=utf-8").send(
      await app.view("dashboard/settings", {
        pageTitle: "Settings",
        config,
        features,
        req,
        announcementWeb,
        ...adminViewData(req, features),
      })
    );
  });

  app.post("/dashboard/settings", async function (req, res) {
    if (!await hasPermission("zander.web.settings", req, res, features)) return;

    const body = req.body ?? {};
    const on = (key) => body[key] === "on";

    const newFeatures = {
      announcements: on("announcements"),
      applications: on("applications"),
      forums: on("forums"),
      support: on("support"),
      server: on("server"),
      ranks: on("ranks"),
      report: on("report"),
      shopdirectory: on("shopdirectory"),
      vault: on("vault"),
      bridge: on("bridge"),
      staffAuditReport: on("staffAuditReport"),
      watch: on("watch"),
      vote: on("vote"),
      events: on("events"),
      discord: {
        events: {
          generalKenobi: on("discord.events.generalKenobi"),
          guildMemberBoost: on("discord.events.guildMemberBoost"),
          guildMemberVerify: on("discord.events.guildMemberVerify"),
          nicknameCheck: on("discord.events.nicknameCheck"),
          unverifiedReminder: on("discord.events.unverifiedReminder"),
          ipAutoDetect: on("discord.events.ipAutoDetect"),
        },
        punishments: on("discord.punishments"),
      },
      filter: {
        link: on("filter.link"),
        phrase: on("filter.phrase"),
      },
      web: {
        login: on("web.login"),
        register: on("web.register"),
      },
      smDiscord: on("smDiscord"),
      smFacebook: on("smFacebook"),
      smTwitter: on("smTwitter"),
      smInstagram: on("smInstagram"),
      smReddit: on("smReddit"),
      smTwitch: on("smTwitch"),
      smYouTube: on("smYouTube"),
      smLinkedIn: on("smLinkedIn"),
      smTikTok: on("smTikTok"),
    };

    // Write to disk
    await fs.writeFile(FEATURES_PATH, JSON.stringify(newFeatures, null, 2) + "\n", "utf8");

    // Mutate the in-memory features object so changes take effect immediately
    // without requiring a server restart.
    Object.keys(features).forEach((k) => delete features[k]);
    Object.assign(features, newFeatures);

    res
      .setCookie("alertType", "success", { path: "/" })
      .setCookie("alertContent", "Settings saved successfully.", { path: "/" })
      .redirect("/dashboard/settings");
  });
}
