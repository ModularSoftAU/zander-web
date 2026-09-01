/**
 * services/support/channels.js
 *
 * The Discord side of a ticket's lifecycle: recreating a ticket's text channel
 * on reopen, deleting it on close, sweeping orphaned `ticket-*` channels with no
 * DB row, and the one-off repair for stale `ticket-pending` channel names.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 * Re-exported by the controller barrel. NOTE: ticket *creation* (which also
 * makes the channel) stays in tickets.js as createSupportTicket.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../../config.json");
import db from "../../controllers/databaseController.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { ensureDiscordChannelColumn } from "./internal.js";
import { getTicketById } from "./tickets.js";
import { getCategoryPermissions } from "./categories.js";
import { applyTicketParticipantPermissions } from "./participants.js";

/**
 * Delete Discord channels that look like ticket channels (name `ticket-<n>` or
 * the legacy `ticket-pending`) but have no matching `supportTickets` row linking
 * them. These are the debris left by a create that failed after the channel was
 * made. Runs on bot startup. `minAgeMinutes` guards against deleting a channel
 * whose row is still being written by an in-flight `createSupportTicket`.
 */
export async function cleanupOrphanTicketChannels(client, { minAgeMinutes = 10, dryRun = false } = {}) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn || !client) return { scanned: 0, deleted: 0 };

    const guildId = config.discord?.guildId ?? process.env.DISCORD_GUILD_ID;
    const categoryId = config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;
    if (!guildId) return { scanned: 0, deleted: 0 };

    let guild;
    try {
        guild = await client.guilds.fetch(guildId);
    } catch (error) {
        console.error("cleanupOrphanTicketChannels: failed to fetch guild", error);
        return { scanned: 0, deleted: 0 };
    }

    let channels;
    try {
        channels = await guild.channels.fetch();
    } catch (error) {
        console.error("cleanupOrphanTicketChannels: failed to fetch channels", error);
        return { scanned: 0, deleted: 0 };
    }

    const linkedIds = await new Promise((resolve) => {
        db.query(
            "SELECT discordChannelId FROM supportTickets WHERE discordChannelId IS NOT NULL",
            (err, rows) => {
                if (err) {
                    console.error("cleanupOrphanTicketChannels: failed to load linked channel ids", err);
                    resolve(null);
                    return;
                }
                resolve(new Set(rows.map((r) => String(r.discordChannelId))));
            },
        );
    });
    if (!linkedIds) return { scanned: 0, deleted: 0 };

    const cutoff = Date.now() - minAgeMinutes * 60 * 1000;
    const candidates = [...channels.values()].filter(
        (ch) =>
            ch &&
            ch.type === ChannelType.GuildText &&
            /^ticket-(pending|\d+)$/.test(ch.name) &&
            (!categoryId || ch.parentId === categoryId) &&
            !linkedIds.has(String(ch.id)) &&
            ch.createdTimestamp &&
            ch.createdTimestamp < cutoff,
    );

    const me = guild.members?.me ?? null;
    let deleted = 0;
    const skipped = []; // channels we cannot touch — reported once, not per-channel

    for (const ch of candidates) {
        // Don't even attempt the API call if the bot plainly can't manage this
        // channel — that just produces a 50001/50013 error per restart.
        const perms = me ? ch.permissionsFor(me) : null;
        if (
            perms &&
            !(
                perms.has(PermissionFlagsBits.ViewChannel) &&
                perms.has(PermissionFlagsBits.ManageChannels)
            )
        ) {
            skipped.push(`${ch.name} (${ch.id})`);
            continue;
        }

        if (dryRun) {
            console.info(`cleanupOrphanTicketChannels: [dry-run] would delete ${ch.name} (${ch.id})`);
            continue;
        }

        try {
            await ch.delete("Orphaned ticket channel with no matching database row");
            deleted += 1;
            console.info(`cleanupOrphanTicketChannels: deleted orphan ${ch.name} (${ch.id})`);
        } catch (error) {
            if (error?.code === 50001 || error?.code === 50013) {
                skipped.push(`${ch.name} (${ch.id})`);
            } else {
                console.error(
                    `cleanupOrphanTicketChannels: failed to delete ${ch.name} (${ch.id})`,
                    error,
                );
            }
        }
    }

    if (deleted) {
        console.info(
            `cleanupOrphanTicketChannels: ${deleted}/${candidates.length} orphan ticket channel(s) removed`,
        );
    }
    if (skipped.length) {
        console.warn(
            `cleanupOrphanTicketChannels: ${skipped.length} orphan ticket channel(s) left in place — ` +
                `bot lacks View Channel + Manage Channels on them (grant access on the ticket category ` +
                `or delete manually): ${skipped.sort().join(", ")}`,
        );
    }
    return { scanned: candidates.length, deleted, skipped: skipped.length };
}

export async function recreateTicketChannel(
    client,
    ticketId,
    { parentCategoryId = null } = {},
) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn) {
        throw new Error("supportTickets.discordChannelId column is unavailable");
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
    }

    const guildId = config.discord?.guildId ?? process.env.DISCORD_GUILD_ID;
    if (!guildId) {
        throw new Error("DISCORD_GUILD_ID is not configured for ticket recreation");
    }

    let guild;
    try {
        guild = await client.guilds.fetch(guildId);
    } catch (guildError) {
        console.error("Failed to fetch Discord guild for ticket recreation", guildError);
        throw guildError;
    }

    if (!guild || !guild.roles?.everyone) {
        throw new Error("Discord guild is unavailable for ticket recreation");
    }

    let owner;
    try {
        owner = await new Promise((resolve) => {
            db.query(
                "SELECT userId, username, discordId FROM users WHERE userId = ? LIMIT 1",
                [ticket.userId],
                (err, results) => {
                    if (err) {
                        console.error("recreateTicketChannel: failed to load ticket owner", err);
                        resolve(null);
                        return;
                    }

                    resolve(results?.[0] || null);
                },
            );
        });
    } catch (ownerError) {
        console.error("recreateTicketChannel: error loading owner", ownerError);
    }

    const staffRoleIds = await getCategoryPermissions(ticket.categoryId);

    // Use explicitly passed parentCategoryId, otherwise use global config
    const resolvedParentId =
        parentCategoryId && parentCategoryId !== "undefined" && parentCategoryId !== ""
            ? parentCategoryId
            : config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;

    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
    ];

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

    if (owner?.discordId) {
        permissionOverwrites.push({
            id: owner.discordId,
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

    const channelOptions = {
        name: `ticket-${ticket.ticketId}`,
        type: ChannelType.GuildText,
        permissionOverwrites,
        reason: `Ticket #${ticket.ticketId} reopened`,
    };

    // Set parent category if configured
    if (resolvedParentId) {
        channelOptions.parent = resolvedParentId;
    }

    const channel = await guild.channels.create(channelOptions);

    await new Promise((resolve) => {
        db.query(
            "UPDATE supportTickets SET discordChannelId = ? WHERE ticketId = ?",
            [channel.id, ticket.ticketId],
            (err) => {
                if (err) {
                    console.error("recreateTicketChannel: failed to persist new channel id", err);
                }
                resolve();
            },
        );
    });

    const siteBaseUrl =
        (config.siteConfiguration && config.siteConfiguration.siteUrl) ||
        process.env.SITE_URL ||
        "https://craftingforchrist.net";
    const normalizedSiteUrl = siteBaseUrl.endsWith("/") ? siteBaseUrl.slice(0, -1) : siteBaseUrl;
    const ticketUrl = `${normalizedSiteUrl}/support/ticket/${ticket.ticketId}`;

    const reopenEmbed = {
        title: `Ticket #${ticket.ticketId}: ${ticket.title}`,
        description: "Ticket reopened from the web dashboard.",
        timestamp: new Date().toISOString(),
        color: 0x2b6cb0,
        fields: [],
    };

    if (owner?.username) {
        reopenEmbed.fields.push({ name: "Owner", value: owner.username, inline: true });
    }

    const viewOnlineButton = {
        type: 2,
        style: 5,
        label: "View Ticket Online",
        url: ticketUrl,
    };

    const closeButton = {
        type: 2,
        style: 4,
        custom_id: "support_ticket_close",
        label: "Close Ticket",
    };

    try {
        await channel.send({
            content: owner?.discordId ? `<@${owner.discordId}> Ticket reopened.` : "Ticket reopened.",
            embeds: [reopenEmbed],
            components: [{ type: 1, components: [viewOnlineButton, closeButton] }],
        });
    } catch (sendError) {
        console.error("recreateTicketChannel: failed to post reopen message", sendError);
    }

    try {
        await applyTicketParticipantPermissions(client, ticket.ticketId);
    } catch (participantError) {
        console.error("recreateTicketChannel: failed to reapply participant permissions", participantError);
    }

    return channel;
}

/**
 * One-off repair for tickets whose Discord channel is still stuck on the
 * "ticket-pending" placeholder name (from before channel creation was
 * changed to name the channel correctly up front). Renames each affected
 * channel to ticket-<id>, spaced out to stay well under Discord's
 * per-channel rename rate limit (2 changes per 10 min).
 *
 * @returns {Promise<{checked: number, renamed: number, failed: Array<{ticketId, error}>}>}
 */
export async function repairPendingTicketChannelNames(client) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn || !client) {
        return { checked: 0, renamed: 0, failed: [] };
    }

    const tickets = await new Promise((resolve, reject) => {
        db.query(
            "SELECT ticketId, discordChannelId FROM supportTickets WHERE discordChannelId IS NOT NULL",
            (err, results) => (err ? reject(err) : resolve(results)),
        );
    });

    let renamed = 0;
    const failed = [];

    for (const ticket of tickets) {
        try {
            const channel = await client.channels.fetch(ticket.discordChannelId);
            if (!channel) continue;

            const expectedName = `ticket-${ticket.ticketId}`;
            if (channel.name === expectedName) continue;

            await channel.setName(expectedName, "Repairing ticket channel name");
            renamed++;
            // Stay well clear of Discord's rename rate limit when repairing many at once.
            await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (error) {
            console.error("repairPendingTicketChannelNames: failed to rename channel", {
                ticketId: ticket.ticketId,
                channelId: ticket.discordChannelId,
            }, error);
            failed.push({ ticketId: ticket.ticketId, error: error.message });
        }
    }

    return { checked: tickets.length, renamed, failed };
}

export async function deleteTicketChannel(client, ticketId, reason = "Ticket closed", knownChannel = null) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn) {
        return false;
    }

    const ticket = await getTicketById(ticketId);
    const storedChannelId = ticket?.discordChannelId ? String(ticket.discordChannelId).trim() : "";
    const canDeleteKnownChannel = Boolean(knownChannel && typeof knownChannel.delete === "function");

    if (!storedChannelId && !canDeleteKnownChannel) {
        return false;
    }

    if (!client && !canDeleteKnownChannel) {
        console.warn("deleteTicketChannel: Discord client unavailable; retaining channel link for retry", { ticketId });
        return false;
    }

    const attemptedChannelIds = new Set();
    let channelDeleted = false;
    const deleteTargets = [];

    if (canDeleteKnownChannel) {
        deleteTargets.push({
            source: "known-channel",
            getChannel: async () => knownChannel,
        });
    }

    if (client && storedChannelId && knownChannel?.id !== storedChannelId) {
        deleteTargets.push({
            source: "stored-channel-id",
            getChannel: async () => client.channels.fetch(storedChannelId),
        });
    }

    for (const target of deleteTargets) {
        let channel;
        try {
            channel = await target.getChannel();
        } catch (fetchError) {
            const isAlreadyDeleted = fetchError?.code === 10003 || fetchError?.status === 404;
            if (isAlreadyDeleted) {
                channelDeleted = true;
                break;
            }

            console.error("deleteTicketChannel: failed to resolve Discord channel for deletion", {
                ticketId,
                channelId: storedChannelId || knownChannel?.id || null,
                source: target.source,
            }, fetchError);
            continue;
        }

        const resolvedChannelId = channel?.id ? String(channel.id).trim() : "";
        if (!channel || attemptedChannelIds.has(resolvedChannelId || target.source)) {
            continue;
        }

        attemptedChannelIds.add(resolvedChannelId || target.source);

        try {
            await channel.delete(reason);
            channelDeleted = true;
            break;
        } catch (error) {
            // Unknown Channel means Discord has already removed it, so clearing the
            // stale database link is safe. Other failures must remain retryable.
            const isAlreadyDeleted = error?.code === 10003 || error?.status === 404;
            if (isAlreadyDeleted) {
                channelDeleted = true;
                break;
            }

            console.error("deleteTicketChannel: failed to delete Discord channel; retaining link for retry", {
                ticketId,
                channelId: resolvedChannelId || storedChannelId || null,
                source: target.source,
            }, error);
        }
    }

    if (!channelDeleted) {
        return false;
    }

    return new Promise((resolve) => {
        db.query(
            "UPDATE supportTickets SET discordChannelId = NULL WHERE ticketId = ?",
            [ticketId],
            (err) => {
                if (err) {
                    console.error("deleteTicketChannel: failed to clear channel id", { ticketId }, err);
                }
                resolve(!err);
            },
        );
    });
}

