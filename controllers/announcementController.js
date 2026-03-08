import db from "./databaseController.js";

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

export async function getWebAnnouncement() {
  try {
    const rows = await queryDb(
      `SELECT * FROM announcements
        WHERE announcementType = 'web' AND enabled = 1
          AND (startDate IS NULL OR startDate <= NOW())
          AND (endDate IS NULL OR endDate >= NOW())
        ORDER BY RAND() LIMIT 1`
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("Error fetching web announcement:", error);
    return null;
  }
}

export async function getPopupAnnouncements() {
  try {
    const rows = await queryDb(
      `SELECT * FROM announcements
        WHERE announcementType = 'popup' AND enabled = 1
          AND (startDate IS NULL OR startDate <= NOW())
          AND (endDate IS NULL OR endDate >= NOW())
        ORDER BY COALESCE(startDate, updatedDate, NOW()) ASC`
    );
    return rows;
  } catch (error) {
    console.error("Error fetching popup announcements:", error);
    return [];
  }
}
