import db from "./databaseController.js";

let notificationTableCheck;

async function ensureNotificationTable() {
  if (!notificationTableCheck) {
    notificationTableCheck = new Promise((resolve) => {
      db.query(
        "CREATE TABLE IF NOT EXISTS userNotifications (\n" +
          "  notificationId INT AUTO_INCREMENT PRIMARY KEY,\n" +
          "  userId INT NOT NULL,\n" +
          "  ticketId INT NULL,\n" +
          "  notificationType VARCHAR(32) NOT NULL,\n" +
          "  title VARCHAR(255) NOT NULL,\n" +
          "  message TEXT NOT NULL,\n" +
          "  url VARCHAR(255) NOT NULL,\n" +
          "  isRead TINYINT(1) NOT NULL DEFAULT 0,\n" +
          "  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n" +
          "  INDEX idx_user_notifications_user (userId),\n" +
          "  INDEX idx_user_notifications_unread (userId, isRead),\n" +
          "  INDEX idx_user_notifications_ticket (ticketId)\n" +
          ")",
        (err) => {
          if (err) {
            console.error("Failed to ensure userNotifications table", err);
            resolve(false);
            return;
          }

          resolve(true);
        },
      );
    });
  }

  return notificationTableCheck;
}

export async function createNotificationsForUsers(userIds, payload) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return 0;

  const uniqueUserIds = [
    ...new Set(
      userIds
        .map((userId) => Number(userId))
        .filter((userId) => Number.isInteger(userId) && userId > 0),
    ),
  ];
  if (!uniqueUserIds.length) return 0;

  const values = uniqueUserIds.map((userId) => [
    userId,
    payload.ticketId ?? null,
    payload.notificationType,
    payload.title,
    payload.message,
    payload.url,
  ]);

  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO userNotifications (userId, ticketId, notificationType, title, message, url) VALUES ?",
      [values],
      (err, results) => {
        if (err) {
          console.error("Failed to insert user notifications", err);
          reject(err);
          return;
        }

        resolve(results.affectedRows || 0);
      },
    );
  });
}

export async function getNotificationSummary(userId, limit = 5) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return { unreadCount: 0, items: [] };

  const unreadCountPromise = new Promise((resolve) => {
    db.query(
      "SELECT COUNT(*) as unreadCount FROM userNotifications WHERE userId = ? AND isRead = 0",
      [userId],
      (err, results) => {
        if (err) {
          console.error("Failed to load unread notification count", err);
          resolve(0);
          return;
        }

        resolve(results?.[0]?.unreadCount || 0);
      },
    );
  });

  const notificationsPromise = new Promise((resolve) => {
    db.query(
      "SELECT notificationId, title, message, url, isRead, createdAt FROM userNotifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
      [userId, limit],
      (err, results) => {
        if (err) {
          console.error("Failed to load notifications", err);
          resolve([]);
          return;
        }

        resolve(results || []);
      },
    );
  });

  const [unreadCount, items] = await Promise.all([unreadCountPromise, notificationsPromise]);

  return { unreadCount, items };
}

export async function getUserNotifications(userId, limit = 50) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return [];

  return new Promise((resolve) => {
    db.query(
      "SELECT notificationId, title, message, url, isRead, createdAt FROM userNotifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
      [userId, limit],
      (err, results) => {
        if (err) {
          console.error("Failed to load notifications for user", err);
          resolve([]);
          return;
        }

        resolve(results || []);
      },
    );
  });
}

export async function getNotificationById(notificationId, userId) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return null;

  return new Promise((resolve) => {
    db.query(
      "SELECT notificationId, title, message, url, isRead, createdAt FROM userNotifications WHERE notificationId = ? AND userId = ? LIMIT 1",
      [notificationId, userId],
      (err, results) => {
        if (err) {
          console.error("Failed to load notification", err);
          resolve(null);
          return;
        }

        resolve(results?.[0] || null);
      },
    );
  });
}

export async function markNotificationRead(notificationId, userId) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return false;

  return new Promise((resolve) => {
    db.query(
      "UPDATE userNotifications SET isRead = 1 WHERE notificationId = ? AND userId = ?",
      [notificationId, userId],
      (err, results) => {
        if (err) {
          console.error("Failed to mark notification as read", err);
          resolve(false);
          return;
        }

        resolve(results.affectedRows > 0);
      },
    );
  });
}

export async function markAllNotificationsRead(userId) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return false;

  return new Promise((resolve) => {
    db.query(
      "UPDATE userNotifications SET isRead = 1 WHERE userId = ? AND isRead = 0",
      [userId],
      (err, results) => {
        if (err) {
          console.error("Failed to mark all notifications as read", err);
          resolve(false);
          return;
        }

        resolve(results.affectedRows >= 0);
      },
    );
  });
}

export async function deleteNotification(notificationId, userId) {
  const hasTable = await ensureNotificationTable();
  if (!hasTable) return false;

  return new Promise((resolve) => {
    db.query(
      "DELETE FROM userNotifications WHERE notificationId = ? AND userId = ?",
      [notificationId, userId],
      (err, results) => {
        if (err) {
          console.error("Failed to delete notification", err);
          resolve(false);
          return;
        }

        resolve(results.affectedRows > 0);
      },
    );
  });
}
