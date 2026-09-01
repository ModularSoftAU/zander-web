/**
 * services/support/status.js
 *
 * Ticket status transitions: open/closed status, the lock and escalation flags,
 * moving a ticket to a different category (which re-syncs the Discord channel's
 * role permissions), and the status-change notification fan-out.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 * Re-exported by the controller barrel.
 */

import db from "../../controllers/databaseController.js";
import { PermissionFlagsBits, OverwriteType } from "discord.js";
import {
  ensureDiscordChannelColumn,
  ensureTicketLockColumn,
  ensureTicketEscalationColumn,
  buildTicketNotificationTarget,
  notifyTicketParticipants,
} from "./internal.js";
import { getTicketById } from "./tickets.js";
import { getCategoryPermissions } from "./categories.js";

export async function notifyTicketStatusChange(ticketId, status, actor) {
    const ticket = await getTicketById(ticketId);
    if (!ticket) return;

    const target = buildTicketNotificationTarget(ticket);
    const actorName = actor?.name || "Staff";
    const statusLabel = status || ticket.status || "updated";
    const title = `Status updated for ${target.label}`;
    const message = `${actorName} set the status to ${statusLabel}.`;

    await notifyTicketParticipants({
        ticket,
        actorUserId: actor?.userId ?? null,
        notificationType: "status",
        title,
        message,
    });
}

export async function updateTicketCategory(client, ticketId, newCategoryId) {
    const hasChannelColumn = await ensureDiscordChannelColumn();

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        throw new Error("Ticket not found");
    }

    const previousCategoryId = ticket.categoryId;
    if (previousCategoryId === newCategoryId) {
        return { changed: false, previousCategoryId, nextCategoryId: newCategoryId };
    }

    const [previousPermissions, nextPermissions] = await Promise.all([
        getCategoryPermissions(previousCategoryId),
        getCategoryPermissions(newCategoryId),
    ]);

    await new Promise((resolve, reject) => {
        db.query(
            "UPDATE supportTickets SET categoryId = ? WHERE ticketId = ?",
            [newCategoryId, ticketId],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            },
        );
    });

    if (!hasChannelColumn || !client || !ticket.discordChannelId) {
        return { changed: true, previousCategoryId, nextCategoryId: newCategoryId };
    }

    let channel;
    try {
        channel = await client.channels.fetch(ticket.discordChannelId);
    } catch (channelError) {
        console.error("updateTicketCategory: failed to fetch Discord channel", channelError);
        return { changed: true, previousCategoryId, nextCategoryId: newCategoryId };
    }

    if (!channel) {
        return { changed: true, previousCategoryId, nextCategoryId: newCategoryId };
    }

    const permissionPromises = [];
    const isSnowflake = (value) => Boolean(value) && /^\d{5,}$/.test(String(value).trim());

    previousPermissions
        .filter((roleId) => roleId && !nextPermissions.includes(roleId))
        .forEach((roleId) => {
            if (!isSnowflake(roleId)) return;
            permissionPromises.push(
                channel.permissionOverwrites.delete(roleId).catch((error) => {
                    console.error("updateTicketCategory: failed to remove old role permission", { roleId, ticketId }, error);
                }),
            );
        });

    nextPermissions
        .filter((roleId) => isSnowflake(roleId))
        .forEach((roleId) => {
            permissionPromises.push(
                channel.permissionOverwrites.edit(
                    roleId,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        AttachFiles: true,
                        ReadMessageHistory: true,
                        ManageMessages: true,
                    },
                    { type: OverwriteType.Role },
                ),
            );
        });

    try {
        await Promise.all(permissionPromises);
    } catch (permissionError) {
        console.error("updateTicketCategory: failed to update Discord permissions", permissionError);
    }

    return { changed: true, previousCategoryId, nextCategoryId: newCategoryId };
}

export async function updateTicketStatus(ticketId, status) {
    return new Promise((resolve, reject) => {
        db.query("UPDATE supportTickets SET status = ? WHERE ticketId = ?", [status, ticketId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export async function setTicketLockState(ticketId, isLocked) {
    const hasLockColumn = await ensureTicketLockColumn();
    if (!hasLockColumn) return null;

    return new Promise((resolve, reject) => {
        db.query("UPDATE supportTickets SET isLocked = ? WHERE ticketId = ?", [isLocked ? 1 : 0, ticketId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export async function setTicketEscalationState(ticketId, isEscalated) {
    const hasEscalationColumn = await ensureTicketEscalationColumn();
    if (!hasEscalationColumn) return null;

    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE supportTickets SET isEscalated = ? WHERE ticketId = ?",
            [isEscalated ? 1 : 0, ticketId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            },
        );
    });
}
