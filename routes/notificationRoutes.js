import { getWebAnnouncement } from "../controllers/announcementController.js";
import { getGlobalImage, setBannerCookie } from "../api/common.js";
import {
  getNotificationSummary,
  getUserNotifications,
  getNotificationById,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/notificationController.js";

export default function notificationRoutes(app, config, features) {
  app.get("/notifications", async function (req, res) {
    if (!req.session.user) {
      return res.view("session/notLoggedIn", {
        pageTitle: "Not Logged In",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    const notifications = await getUserNotifications(req.session.user.userId, 50);
    const summary = await getNotificationSummary(req.session.user.userId, 50);

    return res.view("modules/notifications/index", {
      pageTitle: "Notifications",
      pageDescription: "Notifications",
      config,
      req,
      features,
      notifications,
      unreadCount: summary.unreadCount,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.get("/notifications/summary", async function (req, res) {
    if (!req.session.user) {
      return res.status(401).send({ error: "Not authenticated" });
    }

    const summary = await getNotificationSummary(req.session.user.userId, 10);

    return res.send({
      unreadCount: summary.unreadCount,
      items: summary.items.map((item) => ({
        notificationId: item.notificationId,
        title: item.title,
        message: item.message,
        url: item.url,
        isRead: item.isRead,
        createdAt: item.createdAt,
      })),
    });
  });

  app.get("/notifications/visit/:id", async function (req, res) {
    if (!req.session.user) {
      return res.view("session/notLoggedIn", {
        pageTitle: "Not Logged In",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    const notificationId = Number(req.params.id);
    if (!notificationId) {
      setBannerCookie("warning", "Notification not found.", res);
      return res.redirect("/notifications");
    }

    const notification = await getNotificationById(
      notificationId,
      req.session.user.userId
    );

    if (!notification) {
      setBannerCookie("warning", "Notification not found.", res);
      return res.redirect("/notifications");
    }

    await markNotificationRead(notificationId, req.session.user.userId);

    return res.redirect(notification.url || "/notifications");
  });

  app.post("/notifications/mark-all", async function (req, res) {
    if (!req.session.user) {
      return res.view("session/notLoggedIn", {
        pageTitle: "Not Logged In",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    await markAllNotificationsRead(req.session.user.userId);
    setBannerCookie("success", "All notifications marked as read.", res);
    return res.redirect("/notifications");
  });

  app.post("/notifications/:id/dismiss", async function (req, res) {
    if (!req.session.user) {
      return res.view("session/notLoggedIn", {
        pageTitle: "Not Logged In",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      });
    }

    const notificationId = Number(req.params.id);
    if (!notificationId) {
      setBannerCookie("warning", "Notification not found.", res);
      return res.redirect("/notifications");
    }

    const deleted = await deleteNotification(notificationId, req.session.user.userId);
    if (!deleted) {
      setBannerCookie("warning", "Notification not found.", res);
      return res.redirect("/notifications");
    }

    setBannerCookie("success", "Notification dismissed.", res);
    return res.redirect("/notifications");
  });
}
