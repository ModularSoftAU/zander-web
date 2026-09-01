/**
 * services/user/discordLink.js
 *
 * Linking / unlinking a Discord account and merging a placeholder user row into a real one.
 *
 * Extracted from controllers/userController.js (Phase 7 decomposition).
 * Re-exported by the controllers/userController.js barrel.
 */

import db from "../../controllers/databaseController.js";
import { runQuery } from "./_shared.js";

export async function linkDiscordAccount(userId, discordId, discordHandle = null) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET discordId=?, social_discord=? WHERE userId=?`,
      [discordId, discordHandle, userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

// Repoint the rows that reference a soon-to-be-deleted user row onto the
// surviving row. supportTickets.userId / supportTicketMessages.userId are
// ON DELETE CASCADE, so this MUST run before the placeholder row is deleted
// or the ticket that triggered the ghost account gets destroyed with it.
// supportTicketParticipants has a UNIQUE(ticketId, userId), hence UPDATE IGNORE
// plus a follow-up delete of any rows that could not be moved.
async function repointUserReferences(fromUserId, toUserId) {
  await runQuery(`UPDATE supportTickets SET userId = ? WHERE userId = ?`, [toUserId, fromUserId]);
  await runQuery(`UPDATE supportTicketMessages SET userId = ? WHERE userId = ?`, [toUserId, fromUserId]);
  await runQuery(`UPDATE userNotifications SET userId = ? WHERE userId = ?`, [toUserId, fromUserId]);
  await runQuery(
    `UPDATE IGNORE supportTicketParticipants SET userId = ? WHERE userId = ?`,
    [toUserId, fromUserId]
  );
  await runQuery(`DELETE FROM supportTicketParticipants WHERE userId = ?`, [fromUserId]);
}

/*
    Merge a placeholder ("ghost") user row into a real account row.

    A placeholder row is created by createUnlinkedUser when a Discord user
    opens a support ticket before linking a Minecraft account. When that
    person later registers with their real Minecraft username we want to
    keep the real account and fold the placeholder's Discord link and
    ticket history into it rather than blocking registration.

    - Transfers discordId from the placeholder onto the surviving row when
      the surviving row does not already have one.
    - Repoints ticket / notification foreign keys onto the surviving row.
    - Drops the placeholder's pending verify-link rows (keyed by uuid).
    - Deletes the placeholder row.

    Returns a summary object describing what was moved (for logging).
*/
export async function mergePlaceholderUser(placeholderUserId, survivingUserId) {
  if (!placeholderUserId || !survivingUserId || placeholderUserId === survivingUserId) {
    throw new Error("mergePlaceholderUser requires two distinct user ids");
  }

  const [placeholder] = await runQuery(`SELECT * FROM users WHERE userId = ? LIMIT 1`, [
    placeholderUserId,
  ]);
  const [surviving] = await runQuery(`SELECT * FROM users WHERE userId = ? LIMIT 1`, [
    survivingUserId,
  ]);

  if (!placeholder) throw new Error(`Placeholder user ${placeholderUserId} not found`);
  if (!surviving) throw new Error(`Surviving user ${survivingUserId} not found`);

  const summary = {
    placeholderUserId,
    survivingUserId,
    discordIdTransferred: false,
  };

  if (placeholder.discordId && !surviving.discordId) {
    await runQuery(`UPDATE users SET discordId = ? WHERE userId = ?`, [
      placeholder.discordId,
      survivingUserId,
    ]);
    summary.discordIdTransferred = true;
  }

  // Clear the placeholder's discordId first so the users.discordId lookups
  // (and any unique expectations callers have) never see it on two rows.
  await runQuery(`UPDATE users SET discordId = NULL WHERE userId = ?`, [placeholderUserId]);

  await repointUserReferences(placeholderUserId, survivingUserId);

  if (placeholder.uuid) {
    await runQuery(`DELETE FROM userVerifyLink WHERE uuid = ?`, [placeholder.uuid]);
  }

  await runQuery(`DELETE FROM users WHERE userId = ?`, [placeholderUserId]);

  return summary;
}

export async function unlinkDiscordAccount(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE users SET discordId=NULL, social_discord=NULL WHERE userId=?`,
      [userId],
      function (error) {
        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
}

