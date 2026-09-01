import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../../config.json");
import db from "../../controllers/databaseController.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";

// Phase 7 decomposition: this module is now just ticket creation + the ticket
// row getters. Categories, users, messages, participants, Discord channel
// lifecycle and status transitions are sibling modules under services/support/;
// controllers/supportTicketController.js is a thin barrel that `export *`s all
// of them, so every existing `.../supportTicketController.js` import site is
// unchanged.
import {
  ensureDiscordChannelColumn,
  ensureTicketParticipantTable,
} from "./internal.js";


export async function createSupportTicket(
    client,
    userId,
    categoryId,
    title,
    { discordUserId = null, staffRoleIds = [], parentCategoryId = null } = {},
) {
    const guildId = config.discord?.guildId ?? process.env.DISCORD_GUILD_ID;

    if (!guildId) {
        throw new Error("DISCORD_GUILD_ID is not configured for ticket creation");
    }

    let guild;
    try {
        guild = await client.guilds.fetch(guildId);
    } catch (guildError) {
        console.error("Failed to fetch Discord guild for support ticket creation", guildError);
        throw guildError;
    }

    if (!guild || !guild.roles?.everyone) {
        throw new Error("Discord guild is unavailable for ticket creation");
    }

    // Use explicitly passed parentCategoryId, otherwise use global config
    let targetParentId =
        parentCategoryId && parentCategoryId !== "undefined" && parentCategoryId !== ""
            ? parentCategoryId
            : config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;

    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
    ];

    // The bot must be able to see and post in the channel it just created —
    // without an explicit overwrite the @everyone ViewChannel deny above can
    // stop `channel.send` (the pinned opener embed) from working.
    const botId = client?.user?.id;
    if (botId) {
        permissionOverwrites.push({
            id: botId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    if (discordUserId) {
        permissionOverwrites.push({
            id: discordUserId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    staffRoleIds.forEach((roleId) => {
        permissionOverwrites.push({
            id: roleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
            ],
        });
    });

    const hasChannelColumn = await ensureDiscordChannelColumn();

    // Persist the ticket row FIRST. A Discord API failure can then never leave an
    // orphaned "ticket-pending" channel with no matching DB row (the bug that
    // spammed `getTicketDetailsByChannel: no ticket linked to channel ...`).
    const ticketId = await new Promise((resolve, reject) => {
        db.query(
            "INSERT INTO supportTickets (userId, categoryId, title) VALUES (?, ?, ?)",
            [userId, categoryId, title],
            (err, results) => (err ? reject(err) : resolve(results.insertId)),
        );
    });

    // Create the Discord channel already named with the real ticket id, so a
    // failure part-way through leaves an obviously-named, sweepable channel
    // rather than a bare "ticket-pending".
    const channelCreationOptions = {
        name: `ticket-${ticketId}`,
        type: ChannelType.GuildText,
        permissionOverwrites,
        reason: `Support ticket #${ticketId} for ${discordUserId ?? `user ${userId}`}`,
    };
    if (targetParentId) {
        channelCreationOptions.parent = targetParentId;
    }

    let channel = null;
    try {
        channel = await guild.channels.create(channelCreationOptions);
    } catch (channelError) {
        console.error("createSupportTicket: Discord channel creation failed; ticket persisted without a channel", {
            ticketId,
            parentId: targetParentId,
            discordCode: channelError?.code,
            message: channelError?.message,
        });
        // The row survives — staff can recreate the channel via ticket reopen.
        return { ticketId, channel: null };
    }

    if (!hasChannelColumn) {
        return { ticketId, channel };
    }

    // Link the channel back to the row. If this fails, delete the channel so it
    // never dangles unlinked.
    try {
        await new Promise((resolve, reject) => {
            db.query(
                "UPDATE supportTickets SET discordChannelId = ? WHERE ticketId = ?",
                [channel.id, ticketId],
                (err) => (err ? reject(err) : resolve()),
            );
        });
    } catch (linkError) {
        console.error("createSupportTicket: failed to link channel to ticket; deleting channel", {
            ticketId,
            channelId: channel.id,
            message: linkError?.message,
        });
        try {
            await channel.delete("Failed to link ticket channel to database row");
        } catch (cleanupError) {
            console.error("createSupportTicket: failed to delete unlinked ticket channel", {
                ticketId,
                channelId: channel.id,
            }, cleanupError);
        }
        return { ticketId, channel: null };
    }

    return { ticketId, channel };
}


export async function getTicketsByUserId(userId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM supportTickets WHERE userId = ?", [userId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export async function getTicketsAccessibleByUser(userId, rankSlugs = []) {
    const hasParticipants = await ensureTicketParticipantTable();
    if (!hasParticipants || !Array.isArray(rankSlugs)) {
        return getTicketsByUserId(userId);
    }

    const distinctTicketsQuery = [
        "SELECT DISTINCT st.* FROM supportTickets st",
        "LEFT JOIN supportTicketParticipants pUser ON pUser.ticketId = st.ticketId AND pUser.userId = ?",
    ];

    const params = [userId];

    if (rankSlugs.length) {
        distinctTicketsQuery.push(
            "LEFT JOIN supportTicketParticipants pGroup ON pGroup.ticketId = st.ticketId AND pGroup.rankSlug IN (?)",
        );
        params.push(rankSlugs);
    }

    distinctTicketsQuery.push("WHERE st.userId = ? OR pUser.userId IS NOT NULL");
    params.push(userId);

    if (rankSlugs.length) {
        distinctTicketsQuery.push("OR pGroup.rankSlug IS NOT NULL");
    }

    const queryString = distinctTicketsQuery.join(" ");

    return new Promise((resolve, reject) => {
        db.query(queryString, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export async function getOpenTicketsWithChannelForUser(userId) {
    return new Promise((resolve, reject) => {
        db.query(
            `SELECT DISTINCT st.*
             FROM supportTickets st
             LEFT JOIN supportTicketParticipants p ON p.ticketId = st.ticketId AND p.userId = ?
             WHERE (st.userId = ? OR p.userId IS NOT NULL)
               AND st.discordChannelId IS NOT NULL
               AND st.status NOT IN ('closed', 'locked')`,
            [userId, userId],
            (err, results) => {
                if (err) reject(err);
                else resolve(results);
            },
        );
    });
}

export async function getTicketById(ticketId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM supportTickets WHERE ticketId = ?", [ticketId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
}

export async function getTicketByChannelId(channelId) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn) {
        return null;
    }

    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM supportTickets WHERE discordChannelId = ?", [channelId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
}

export async function getTicketDetailsByChannel(channelId) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn) {
        return null;
    }

    return new Promise((resolve, reject) => {
        db.query(
            "SELECT t.*, u.discordId FROM supportTickets t LEFT JOIN users u ON t.userId = u.userId WHERE t.discordChannelId = ?",
            [channelId],
            (err, results) => {
                if (err) {
                    console.error("getTicketDetailsByChannel: query failed", { channelId, message: err.message });
                    reject(err);
                } else {
                    if (!results.length) {
                        console.warn("getTicketDetailsByChannel: no ticket linked to channel", { channelId });
                    }
                    resolve(results[0]);
                }
            }
        );
    });
}

export async function getAllTickets() {
    return new Promise((resolve, reject) => {
        db.query("SELECT t.*, u.username FROM supportTickets t JOIN users u ON t.userId = u.userId", (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export async function getTicketsByCategory(categoryId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT t.*, u.username FROM supportTickets t JOIN users u ON t.userId = u.userId WHERE t.categoryId = ?", [categoryId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}


