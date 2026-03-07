import { getGlobalImage, isLoggedIn } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import {
  getPublicLiveContent,
  getPublicVideoContent,
} from "../controllers/watchController.js";

export default function watchSiteRoutes(app, client, fetch, moment, config, db, features, lang) {
  //
  // Public /watch page
  //
  app.get("/watch", async function (req, res) {
    if (!features.watch) {
      return res.status(404).view("session/notFound", {
        pageTitle: "404 Not Found",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    try {
      const [liveContent, videoContent] = await Promise.all([
        getPublicLiveContent(),
        getPublicVideoContent(20),
      ]);

      return res.view("modules/watch/watch", {
        pageTitle: "Watch",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
        liveContent,
        videoContent,
        moment,
      });
    } catch (error) {
      console.error("[WATCH] Failed to load watch page", error);
      return res.status(500).view("session/error", {
        pageTitle: "Server Error",
        config,
        req,
        error,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }
  });

  //
  // JSON API: live content
  //
  app.get("/api/watch/live", async function (req, res) {
    try {
      const live = await getPublicLiveContent();
      return res.send({ success: true, data: live });
    } catch (error) {
      console.error("[WATCH] /api/watch/live error", error);
      return res.status(500).send({ success: false, message: "Failed to fetch live content." });
    }
  });

  //
  // JSON API: video content
  //
  app.get("/api/watch/videos", async function (req, res) {
    try {
      const videos = await getPublicVideoContent(20);
      return res.send({ success: true, data: videos });
    } catch (error) {
      console.error("[WATCH] /api/watch/videos error", error);
      return res.status(500).send({ success: false, message: "Failed to fetch video content." });
    }
  });

  //
  // JSON API: combined feed
  //
  app.get("/api/watch", async function (req, res) {
    try {
      const [live, videos] = await Promise.all([
        getPublicLiveContent(),
        getPublicVideoContent(20),
      ]);
      return res.send({ success: true, data: { live, videos } });
    } catch (error) {
      console.error("[WATCH] /api/watch error", error);
      return res.status(500).send({ success: false, message: "Failed to fetch watch feed." });
    }
  });
}
