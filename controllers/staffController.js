import { hashEmail } from "../api/common.js";
import db from "./databaseController.js";

/**
 * Generates a profile picture URL based on user data.
 * Uses Craftatar for Minecraft skins or Gravatar for email-based avatars.
 * Falls back to mc-heads if no profile picture type is set.
 */
async function toAvatarUrl(row) {
  const pictureType = row.profilePicture_type;

  if (pictureType === "CRAFTATAR" && row.uuid) {
    return `https://crafthead.net/helm/${row.uuid}`;
  }

  if (pictureType === "GRAVATAR" && row.profilePicture_email) {
    const emailHash = await hashEmail(row.profilePicture_email);
    return `https://gravatar.com/avatar/${emailHash}?size=300`;
  }

  // Default fallback to crafthead using UUID or mc-heads using username
  if (row.uuid) {
    return `https://crafthead.net/helm/${row.uuid}`;
  }

  return `https://mc-heads.net/avatar/${row.username}/128`;
}

/**
 * Fetches all staff page data including active staff ranks, users, and retired staff.
 * Returns data structured for the staff.ejs view template.
 */
export async function getStaffPageData() {
  // 1) Get all ranks for the "Active Staff" section
  // Excludes default, retired, donator ranks, and non-staff ranks
  const ranks = await new Promise((resolve, reject) => {
    db.query(
      `SELECT rankSlug, displayName, priority, rankTextColour, isStaff, isDonator
       FROM ranks
       WHERE isStaff = 1
         AND isDonator = 0
         AND rankSlug NOT IN ('default', 'retired')
       ORDER BY priority DESC`,
      function (error, results) {
        if (error) {
          return reject(error);
        }
        resolve(results || []);
      }
    );
  });

  // 2) Get all users belonging to staff ranks with their per-rank title
  // Users may appear multiple times if they hold multiple staff ranks
  const rankUsersRaw = await new Promise((resolve, reject) => {
    db.query(
      `SELECT
        ur.rankSlug,
        u.username,
        ur.title,
        u.uuid,
        u.profilePicture_type,
        u.profilePicture_email
       FROM userRanks ur
       INNER JOIN users u ON u.userId = ur.userId
       INNER JOIN ranks r ON r.rankSlug = ur.rankSlug
       WHERE r.isStaff = 1
         AND r.isDonator = 0
         AND ur.rankSlug NOT IN ('default', 'retired')
       ORDER BY r.priority DESC, u.username ASC`,
      function (error, results) {
        if (error) {
          return reject(error);
        }
        resolve(results || []);
      }
    );
  });

  // Process rank users and generate avatar URLs
  const rankUsers = await Promise.all(
    rankUsersRaw.map(async (r) => ({
      rankSlug: r.rankSlug,
      username: r.username,
      title: r.title || "",
      profilePicture: await toAvatarUrl(r),
    }))
  );

  // 3) Get retired staff users
  const retiredRaw = await new Promise((resolve, reject) => {
    db.query(
      `SELECT
        ur.rankSlug,
        u.username,
        ur.title,
        u.uuid,
        u.profilePicture_type,
        u.profilePicture_email
       FROM userRanks ur
       INNER JOIN users u ON u.userId = ur.userId
       WHERE ur.rankSlug = 'retired'
       ORDER BY u.username ASC`,
      function (error, results) {
        if (error) {
          return reject(error);
        }
        resolve(results || []);
      }
    );
  });

  // Process retired users and generate avatar URLs
  const retiredUsers = await Promise.all(
    retiredRaw.map(async (r) => ({
      rankSlug: "retired",
      username: r.username,
      title: r.title || "",
      profilePicture: await toAvatarUrl(r),
    }))
  );

  return {
    ranks,
    rankUsers,
    retiredUsers,
  };
}
