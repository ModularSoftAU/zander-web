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

  await foldFriendGraph(fromUserId, toUserId);
}

/*
    Fold the placeholder's friendships, blocks and privacy row into the
    surviving account.

    Friendship and block rows carry the user id in TWO columns and both have a
    unique index on the ordered pair, so a blind UPDATE would either create a
    self-referential row or collide with a relationship the survivor already
    holds. For each placeholder row we therefore either repoint it (survivor has
    no relationship with the other party yet) or drop it as a duplicate. Without
    this, merging a placeholder that has friendships orphans them.
*/
async function foldFriendGraph(fromUserId, toUserId) {
  // ---- friendships ----
  const placeholderFriendships = await runQuery(
    `SELECT friendshipId, requesterId, addresseeId FROM userFriendships
      WHERE requesterId = ? OR addresseeId = ?`,
    [fromUserId, fromUserId]
  );
  const survivorFriendships = await runQuery(
    `SELECT requesterId, addresseeId FROM userFriendships
      WHERE requesterId = ? OR addresseeId = ?`,
    [toUserId, toUserId]
  );
  const survivorFriendOf = new Set(
    survivorFriendships.map((r) =>
      r.requesterId === toUserId ? r.addresseeId : r.requesterId
    )
  );

  for (const row of placeholderFriendships) {
    const other =
      row.requesterId === fromUserId ? row.addresseeId : row.requesterId;

    if (other === toUserId || survivorFriendOf.has(other)) {
      // Pairs with the survivor (would self-loop), or the survivor already has
      // a relationship with this person — drop the placeholder's row.
      await runQuery(`DELETE FROM userFriendships WHERE friendshipId = ?`, [
        row.friendshipId,
      ]);
    } else {
      await runQuery(
        `UPDATE userFriendships SET requesterId = ? WHERE friendshipId = ? AND requesterId = ?`,
        [toUserId, row.friendshipId, fromUserId]
      );
      await runQuery(
        `UPDATE userFriendships SET addresseeId = ? WHERE friendshipId = ? AND addresseeId = ?`,
        [toUserId, row.friendshipId, fromUserId]
      );
      survivorFriendOf.add(other);
    }
  }

  // ---- blocks (one-directional; the pair is ordered) ----
  const placeholderBlocks = await runQuery(
    `SELECT blockId, blockerId, blockedId FROM userBlocks
      WHERE blockerId = ? OR blockedId = ?`,
    [fromUserId, fromUserId]
  );
  const survivorBlocks = await runQuery(
    `SELECT blockerId, blockedId FROM userBlocks
      WHERE blockerId = ? OR blockedId = ?`,
    [toUserId, toUserId]
  );
  const survivorBlockPairs = new Set(
    survivorBlocks.map((r) => `${r.blockerId}:${r.blockedId}`)
  );

  for (const row of placeholderBlocks) {
    const newBlocker = row.blockerId === fromUserId ? toUserId : row.blockerId;
    const newBlocked = row.blockedId === fromUserId ? toUserId : row.blockedId;

    if (
      newBlocker === newBlocked ||
      survivorBlockPairs.has(`${newBlocker}:${newBlocked}`)
    ) {
      await runQuery(`DELETE FROM userBlocks WHERE blockId = ?`, [row.blockId]);
    } else {
      await runQuery(
        `UPDATE userBlocks SET blockerId = ?, blockedId = ? WHERE blockId = ?`,
        [newBlocker, newBlocked, row.blockId]
      );
      survivorBlockPairs.add(`${newBlocker}:${newBlocked}`);
    }
  }

  // ---- privacy settings: the survivor's own row wins ----
  await runQuery(`DELETE FROM userPrivacySettings WHERE userId = ?`, [fromUserId]);
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

