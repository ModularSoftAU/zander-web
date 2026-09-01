/**
 * services/support/messages.js
 *
 * Ticket messages / replies: persisting a new message (mirroring web replies to
 * the Discord channel and fanning out participant notifications) and loading a
 * ticket's message thread for the web view (avatars, rank badges, @-mention
 * linkification, internal-note filtering).
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 * Re-exported by the controller barrel.
 */

import db, { luckpermsDb } from "../../controllers/databaseController.js";
import {
  buildAvatarUrl,
  buildTicketNotificationTarget,
  trimNotificationMessage,
  notifyTicketParticipants,
  ensureTicketMessageInternalColumn,
  ensureTicketMessageTypeColumn,
} from "./internal.js";
import { getTicketById } from "./tickets.js";
import { getUserById } from "./users.js";

export async function createSupportTicketMessage(
    client,
    ticketId,
    userId,
    message,
    source = "web",
    options = {},
) {
    const isInternal = Boolean(options.isInternal);
    const skipDiscordPost = Boolean(options.skipDiscordPost);
    const messageType = typeof options.messageType === "string" ? options.messageType : "message";
    console.info("createSupportTicketMessage invoked", {
        ticketId,
        userId,
        source,
        messageLength: message?.length ?? 0,
        isInternal,
        messageType,
        skipDiscordPost,
    });

    const hasInternalColumn = await ensureTicketMessageInternalColumn();
    const hasMessageTypeColumn = await ensureTicketMessageTypeColumn();

    if (source === "web" && !isInternal && !skipDiscordPost) {
        try {
            const ticket = await getTicketById(ticketId);
            if (!ticket?.discordChannelId) {
                console.warn("No Discord channel stored for ticket", ticketId);
            } else if (!client) {
                console.warn("Discord client unavailable; skipping channel post for web reply", ticketId);
            } else {
                console.info("Fetching Discord channel for web reply", {
                    ticketId,
                    channelId: ticket.discordChannelId,
                });

                let channel;
                try {
                    channel = await client.channels.fetch(ticket.discordChannelId);
                } catch (error) {
                    console.error("Failed to fetch Discord channel for ticket", ticketId, error);
                }

                if (channel) {
                    let senderProfile = null;

                    try {
                        senderProfile = await new Promise((resolve) => {
                            db.query(
                                "SELECT username, profilePicture_type, profilePicture_email, uuid FROM users WHERE userId = ? LIMIT 1",
                                [userId],
                                (err, results) => {
                                    if (err) {
                                        console.error("Failed to load user profile for ticket message", err);
                                        resolve(null);
                                        return;
                                    }

                                    resolve(results?.[0] || null);
                                },
                            );
                        });
                    } catch (profileError) {
                        console.error("createSupportTicketMessage: error loading sender profile", profileError);
                    }

                    const avatarUrl = await buildAvatarUrl(senderProfile);

                    const embed = {
                        author: {
                            name: senderProfile?.username || `User ${userId}`,
                        },
                        description: message,
                        timestamp: new Date().toISOString(),
                    };

                    if (avatarUrl) {
                        embed.author.icon_url = avatarUrl;
                        embed.thumbnail = { url: avatarUrl };
                    }

                    try {
                        const sentMessage = await channel.send({ embeds: [embed] });
                        console.info("Sent web reply to Discord channel", {
                            ticketId,
                            channelId: ticket.discordChannelId,
                            discordMessageId: sentMessage?.id,
                        });
                    } catch (error) {
                        console.error("Failed to send web reply to Discord channel", ticketId, error);
                    }
                } else {
                    console.warn("Discord channel fetch returned null for ticket", ticketId);
                }
            }
        } catch (error) {
            console.error("createSupportTicketMessage: failed to post to Discord", error);
        }
    }

    return new Promise((resolve, reject) => {
        let insertQuery;
        const params = [ticketId, userId, message, JSON.stringify([])];

        if (hasMessageTypeColumn) {
            insertQuery =
                "INSERT INTO supportTicketMessages (ticketId, userId, message, attachments, messageType" +
                (hasInternalColumn ? ", isInternal" : "") +
                ") VALUES (?, ?, ?, ?, ?" +
                (hasInternalColumn ? ", ?" : "") +
                ")";
            params.push(messageType);
        } else {
            insertQuery = hasInternalColumn
                ? "INSERT INTO supportTicketMessages (ticketId, userId, message, attachments, isInternal) VALUES (?, ?, ?, ?, ?)"
                : "INSERT INTO supportTicketMessages (ticketId, userId, message, attachments) VALUES (?, ?, ?, ?)";
        }

        if (hasInternalColumn) {
            params.push(isInternal ? 1 : 0);
        }

        db.query(insertQuery, params, async (err, results) => {
            if (err) {
                console.error("Failed to persist support ticket message", { ticketId, userId }, err);
                reject(err);
                return;
            }

            console.info("Persisted support ticket message", {
                ticketId,
                userId,
                messageId: results.insertId,
                source,
                isInternal,
            });

            if (!isInternal) {
                try {
                    const ticket = await getTicketById(ticketId);
                    const target = buildTicketNotificationTarget(ticket);
                    const actor = await getUserById(userId);
                    const actorName = actor?.username || `User ${userId}`;

                    if (messageType === "status") {
                        const title = `Status updated for ${target.label}`;
                        const statusMessage = trimNotificationMessage(message || `${actorName} updated the status.`);
                        await notifyTicketParticipants({
                            ticket,
                            actorUserId: userId,
                            notificationType: "status",
                            title,
                            message: statusMessage,
                        });
                    } else if (messageType === "message") {
                        const title = `New comment on ${target.label}`;
                        const commentMessage = `${actorName} commented: ${trimNotificationMessage(message)}`;
                        await notifyTicketParticipants({
                            ticket,
                            actorUserId: userId,
                            notificationType: "comment",
                            title,
                            message: commentMessage,
                        });
                    }
                } catch (notificationError) {
                    console.error("Failed to prepare ticket notification", notificationError);
                }
            }
            resolve(results.insertId);
        });
    });
}

export async function getTicketMessages(ticketId, includeInternal = false) {
    const hasInternalColumn = await ensureTicketMessageInternalColumn();
    const hasMessageTypeColumn = await ensureTicketMessageTypeColumn();
    const baseMessages = await new Promise((resolve, reject) => {
        const internalSelect = hasInternalColumn ? "" : ", 0 as isInternal";
        const typeSelect = hasMessageTypeColumn ? "" : ", 'message' as messageType";
        db.query(
            `SELECT m.*, u.username, u.discordId, u.profilePicture_type, u.profilePicture_email, u.uuid${internalSelect}${typeSelect} FROM supportTicketMessages m JOIN users u ON m.userId = u.userId WHERE m.ticketId = ? ORDER BY m.createdAt ASC`,
            [ticketId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            },
        );
    });

    if (!baseMessages.length) return [];

    const filteredMessages = includeInternal
        ? baseMessages
        : baseMessages.filter((message) => !message.isInternal);

    const uniqueUserIds = [...new Set(filteredMessages.map((message) => message.userId))];
    let userRanks = {};

    const mentionMatches = new Set();
    filteredMessages.forEach((message) => {
        const regex = /<@(\d+)>/g;
        let match;
        while ((match = regex.exec(message.message))) {
            mentionMatches.add(match[1]);
        }
    });

    let mentionUsers = {};
    if (mentionMatches.size > 0) {
        mentionUsers = await new Promise((resolve) => {
            db.query(
                "SELECT userId, username, discordId FROM users WHERE discordId IN (?)",
                [[...mentionMatches]],
                (err, results) => {
                    if (err) {
                        console.error("Failed to load mention users for ticket messages", err);
                        resolve({});
                        return;
                    }

                    const lookup = {};
                    results.forEach((row) => {
                        lookup[row.discordId] = {
                            userId: row.userId,
                            username: row.username,
                            profileUrl: row.username ? `/profile/${encodeURIComponent(row.username)}` : null,
                        };
                    });

                    resolve(lookup);
                },
            );
        });
    }

    if (uniqueUserIds.length > 0) {
            // LuckPerms lives on a separate MySQL server from the main app
            // DB, so this can't be read via the (cross-server, unreliable)
            // `userRanks`/`ranks` views — resolve uuids from the main DB,
            // then query luckpermsDb directly and join in JS.
            userRanks = await (async () => {
                try {
                    const webUsers = await new Promise((resolve, reject) => {
                        db.query(
                            `SELECT userId, uuid FROM users WHERE userId IN (?) AND uuid IS NOT NULL`,
                            [uniqueUserIds],
                            (err, results) => (err ? reject(err) : resolve(results)),
                        );
                    });
                    if (!webUsers.length) return {};

                    const uuidToUserId = {};
                    for (const u of webUsers) uuidToUserId[u.uuid.toLowerCase()] = u.userId;
                    const uuids = Object.keys(uuidToUserId);

                    const groupRows = await new Promise((resolve, reject) => {
                        luckpermsDb.query(
                            `SELECT uuid, SUBSTRING_INDEX(permission, '.', -1) AS rankSlug
                               FROM luckperms_user_permissions
                              WHERE uuid IN (?) AND permission LIKE 'group.%' AND value = 1
                                AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
                            [uuids],
                            (err, results) => (err ? reject(err) : resolve(results)),
                        );
                    });
                    if (!groupRows.length) return {};

                    const rankSlugs = [...new Set(groupRows.map((r) => r.rankSlug))];
                    const metaRows = await new Promise((resolve, reject) => {
                        luckpermsDb.query(
                            `SELECT name, permission FROM luckperms_group_permissions
                              WHERE name IN (?) AND server = 'global' AND world = 'global' AND value = 1
                                AND (
                                  permission LIKE 'displayname.%'
                                  OR permission LIKE 'weight.%'
                                  OR permission LIKE 'meta.rankbadgecolour.%'
                                  OR permission LIKE 'meta.ranktextcolour.%'
                                )`,
                            [rankSlugs],
                            (err, results) => (err ? reject(err) : resolve(results)),
                        );
                    });

                    const meta = {};
                    for (const row of metaRows) {
                        const m = meta[row.name] || (meta[row.name] = {});
                        const p = row.permission;
                        if (p.startsWith("displayname.")) m.displayName = p.slice("displayname.".length);
                        else if (p.startsWith("weight.")) m.priority = parseInt(p.slice("weight.".length), 10) || 0;
                        else if (p.startsWith("meta.rankbadgecolour.")) m.rankBadgeColour = "#" + p.slice("meta.rankbadgecolour.".length);
                        else if (p.startsWith("meta.ranktextcolour.")) m.rankTextColour = "#" + p.slice("meta.ranktextcolour.".length);
                    }

                    const grouped = {};
                    for (const row of groupRows) {
                        const userId = uuidToUserId[row.uuid.toLowerCase()];
                        if (!userId) continue;
                        const m = meta[row.rankSlug] || {};
                        if (!grouped[userId]) grouped[userId] = [];
                        grouped[userId].push({
                            rankSlug: row.rankSlug,
                            displayName: m.displayName || row.rankSlug,
                            badgeColor: m.rankBadgeColour || null,
                            textColor: m.rankTextColour || null,
                            priority: m.priority || 0,
                        });
                    }
                    Object.values(grouped).forEach((ranks) => {
                        ranks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                    });
                    return grouped;
                } catch (err) {
                    console.error("Failed to load ranks for ticket messages", err);
                    return {};
                }
            })();
    }

    const resolvedMessages = [];

    const escapeHtml = (value = "") =>
        value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    for (const message of filteredMessages) {
        const avatarUrl = await buildAvatarUrl(message);

        const profileUrl = message.username ? `/profile/${encodeURIComponent(message.username)}` : null;

        const escapedMessage = escapeHtml(message.message || "");
        const renderedMessage = escapedMessage.replace(/&lt;@(\d+)&gt;/g, (match, discordId) => {
            const mentionUser = mentionUsers[discordId];
            if (mentionUser?.profileUrl && mentionUser?.username) {
                return `<a href="${mentionUser.profileUrl}" class="fw-semibold">@${escapeHtml(mentionUser.username)}</a>`;
            }
            return `@${discordId}`;
        });

        resolvedMessages.push({
            ...message,
            avatarUrl,
            profileUrl,
            ranks: userRanks[message.userId] || [],
            isInternal: Boolean(message.isInternal),
            messageType: message.messageType || "message",
            renderedMessage,
        });
    }

    return resolvedMessages;
}
