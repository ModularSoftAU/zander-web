/**
 * services/support/participants.js
 *
 * Ticket participants: the supportTicketParticipants rows (individual users and
 * rank/role groups granted access to a ticket) and the Discord channel
 * permission-overwrite sync that mirrors them.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 * Re-exported by the controller barrel.
 */

import db from "../../controllers/databaseController.js";
import { PermissionFlagsBits, OverwriteType } from "discord.js";
import {
  ensureTicketParticipantTable,
  ensureDiscordChannelColumn,
} from "./internal.js";
import { getTicketById } from "./tickets.js";
import { getCategoryPermissions, getLuckPermRankRoles } from "./categories.js";

export async function getTicketParticipants(ticketId) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return { users: [], groups: [] };

    return new Promise((resolve) => {
        db.query(
            "SELECT p.*, u.username, u.discordId FROM supportTicketParticipants p LEFT JOIN users u ON p.userId = u.userId WHERE p.ticketId = ?",
            [ticketId],
            (err, results) => {
                if (err) {
                    console.error("getTicketParticipants: failed to load participants", err);
                    resolve({ users: [], groups: [] });
                    return;
                }

                const users = results
                    .filter((row) => row.userId)
                    .map((row) => ({
                        participantId: row.participantId,
                        userId: row.userId,
                        username: row.username,
                        discordId: row.discordId,
                    }));

                const groups = results
                    .filter((row) => row.roleId)
                    .map((row) => ({
                        participantId: row.participantId,
                        roleId: row.roleId,
                        roleName: row.roleName,
                        rankSlug: row.rankSlug,
                        badgeColor: row.badgeColor,
                        textColor: row.textColor,
                    }));

                resolve({ users, groups });
            },
        );
    });
}

export async function addTicketUserParticipant(ticketId, user) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return null;

    return new Promise((resolve, reject) => {
        db.query(
            "INSERT IGNORE INTO supportTicketParticipants (ticketId, userId) VALUES (?, ?)",
            [ticketId, user.userId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.insertId);
                }
            },
        );
    });
}

export async function addTicketGroupParticipant(ticketId, group) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return null;

    const roleId = group?.id ? String(group.id).trim() : "";
    if (!/^\d{5,}$/.test(roleId)) {
        console.warn("addTicketGroupParticipant: skipping invalid Discord role id", { ticketId, roleId });
        return null;
    }

    return new Promise((resolve, reject) => {
        db.query(
            "INSERT IGNORE INTO supportTicketParticipants (ticketId, roleId, rankSlug, roleName, badgeColor, textColor) VALUES (?, ?, ?, ?, ?, ?)",
            [ticketId, roleId, group.rankSlug, group.name, group.badgeColor, group.textColor],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.insertId);
                }
            },
        );
    });
}

async function hasExistingGroupParticipant(ticketId, roleId) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return true;

    return new Promise((resolve) => {
        db.query(
            "SELECT 1 FROM supportTicketParticipants WHERE ticketId = ? AND roleId = ? LIMIT 1",
            [ticketId, roleId],
            (err, results) => {
                if (err) {
                    console.error("hasExistingGroupParticipant: failed to check role participant", err);
                    resolve(true);
                } else {
                    resolve(results.length > 0);
                }
            },
        );
    });
}

async function hasExistingUserParticipant(ticketId, userId) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return true;

    return new Promise((resolve) => {
        db.query(
            "SELECT 1 FROM supportTicketParticipants WHERE ticketId = ? AND userId = ? LIMIT 1",
            [ticketId, userId],
            (err, results) => {
                if (err) {
                    console.error("hasExistingUserParticipant: failed to check user participant", err);
                    resolve(true);
                } else {
                    resolve(results.length > 0);
                }
            },
        );
    });
}

export async function removeTicketUserParticipant(ticketId, userId) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return false;

    return new Promise((resolve, reject) => {
        db.query(
            "DELETE FROM supportTicketParticipants WHERE ticketId = ? AND userId = ?",
            [ticketId, userId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.affectedRows > 0);
                }
            },
        );
    });
}

export async function removeTicketGroupParticipant(ticketId, roleId) {
    const hasTable = await ensureTicketParticipantTable();
    if (!hasTable) return false;

    return new Promise((resolve, reject) => {
        db.query(
            "DELETE FROM supportTicketParticipants WHERE ticketId = ? AND roleId = ?",
            [ticketId, roleId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.affectedRows > 0);
                }
            },
        );
    });
}

export async function syncParticipantsForMessage(
    client,
    ticketId,
    { userId, discordRoleIds = [], rankSlugs = [], syncGroups = false },
) {
    const newParticipantPromises = [];

    if (userId && !(await hasExistingUserParticipant(ticketId, userId))) {
        newParticipantPromises.push(addTicketUserParticipant(ticketId, { userId }));
    }

    if (syncGroups) {
        const ticket = await getTicketById(ticketId);
        const categoryPermissions = ticket ? await getCategoryPermissions(ticket.categoryId) : [];
        const allowedRoleIds = new Set(categoryPermissions || []);
        const rankOptions = await getLuckPermRankRoles();

        const eligibleRanks = rankOptions.filter(
            (rank) =>
                rank.id &&
                /^\d{5,}$/.test(rank.id) &&
                allowedRoleIds.has(rank.id) &&
                (discordRoleIds.includes(rank.id) || rankSlugs.includes(rank.rankSlug)),
        );

        for (const rank of eligibleRanks) {
            const exists = await hasExistingGroupParticipant(ticketId, rank.id);
            if (!exists) {
                newParticipantPromises.push(addTicketGroupParticipant(ticketId, rank));
            }
        }
    }

    if (newParticipantPromises.length > 0) {
        try {
            await Promise.all(newParticipantPromises);
            await applyTicketParticipantPermissions(client, ticketId);
        } catch (error) {
            console.error("syncParticipantsForMessage: failed to add participants", error);
        }
    }
}

export async function removeTicketParticipantPermissions(
    client,
    ticketId,
    { discordIds = [], roleIds = [] } = {},
) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn) return;

    const ticket = await getTicketById(ticketId);
    if (!ticket?.discordChannelId) {
        return;
    }

    if (!client) {
        console.warn("removeTicketParticipantPermissions: Discord client unavailable; skipping channel permission updates");
        return;
    }

    let channel;
    try {
        channel = await client.channels.fetch(ticket.discordChannelId);
    } catch (error) {
        console.error("removeTicketParticipantPermissions: failed to fetch ticket channel", error);
        return;
    }

    const isSnowflake = (value) => Boolean(value) && /^\d{5,}$/.test(String(value).trim());
    const removals = [];

    discordIds
        .map((id) => String(id).trim())
        .filter((id) => isSnowflake(id))
        .forEach((id) => {
            removals.push(
                channel.permissionOverwrites.delete(id).catch((error) => {
                    console.error("removeTicketParticipantPermissions: failed to remove user overwrite", { ticketId, id }, error);
                }),
            );
        });

    roleIds
        .map((id) => String(id).trim())
        .filter((id) => isSnowflake(id))
        .forEach((id) => {
            removals.push(
                channel.permissionOverwrites.delete(id).catch((error) => {
                    console.error("removeTicketParticipantPermissions: failed to remove role overwrite", { ticketId, id }, error);
                }),
            );
        });

    try {
        await Promise.all(removals);
    } catch (error) {
        console.error("removeTicketParticipantPermissions: failed to update channel permissions", error);
    }
}

export async function applyTicketParticipantPermissions(client, ticketId) {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    const hasTable = await ensureTicketParticipantTable();

    if (!hasChannelColumn || !hasTable) return;

    const ticket = await getTicketById(ticketId);
    if (!ticket?.discordChannelId) {
        return;
    }

    const participants = await getTicketParticipants(ticketId);

    if (!client) {
        console.warn("applyTicketParticipantPermissions: Discord client unavailable; skipping channel permission updates");
        return;
    }

    let channel;
    try {
        channel = await client.channels.fetch(ticket.discordChannelId);
    } catch (error) {
        console.error("applyTicketParticipantPermissions: failed to fetch ticket channel", error);
        return;
    }

    const permissionUpdates = [];

    const isSnowflake = (value) => Boolean(value) && /^\d{5,}$/.test(String(value).trim());

    const botPerms = channel.permissionsFor?.(channel.guild?.members?.me);
    const canManagePermissions = botPerms ? botPerms.has(PermissionFlagsBits.ManageRoles) : null;

    participants.users
        .map((user) => (user.discordId ? String(user.discordId).trim() : ""))
        .filter((id) => isSnowflake(id))
        .forEach((discordId) => {
            permissionUpdates.push(
                channel.permissionOverwrites
                    .edit(
                        discordId,
                        {
                            ViewChannel: true,
                            SendMessages: true,
                            AttachFiles: true,
                            ReadMessageHistory: true,
                        },
                        // Explicit type: the target user may not be cached (never
                        // seen by the bot), which otherwise fails with InvalidType
                        // "Supplied parameter is not a User nor a Role".
                        { type: OverwriteType.Member },
                    )
                    .catch((error) => {
                        console.error("applyTicketParticipantPermissions: failed to grant user overwrite", {
                            ticketId,
                            channelId: channel.id,
                            targetUserId: discordId,
                            canManagePermissions,
                            discordCode: error?.code,
                            status: error?.status,
                            message: error?.message,
                        });
                        throw error;
                    }),
            );
        });

    participants.groups
        .map((group) => (group.roleId ? String(group.roleId).trim() : ""))
        .filter((roleId) => {
            const valid = isSnowflake(roleId);
            if (!valid) {
                console.warn("applyTicketParticipantPermissions: skipping invalid role id", { ticketId, roleId });
            }
            return valid;
        })
        .forEach((roleId) => {
            const role = channel.guild?.roles?.cache?.get(roleId);
            const botHighest = channel.guild?.members?.me?.roles?.highest;
            permissionUpdates.push(
                channel.permissionOverwrites
                    .edit(
                        roleId,
                        {
                            ViewChannel: true,
                            SendMessages: true,
                            AttachFiles: true,
                            ReadMessageHistory: true,
                        },
                        { type: OverwriteType.Role },
                    )
                    .catch((error) => {
                        console.error("applyTicketParticipantPermissions: failed to grant role overwrite", {
                            ticketId,
                            channelId: channel.id,
                            targetRoleId: roleId,
                            targetRoleName: role?.name ?? "(uncached)",
                            targetRolePosition: role?.position ?? null,
                            botHighestRole: botHighest?.name ?? null,
                            botHighestPosition: botHighest?.position ?? null,
                            botAboveTarget: role && botHighest ? botHighest.position > role.position : null,
                            canManagePermissions,
                            discordCode: error?.code,
                            status: error?.status,
                            message: error?.message,
                        });
                        throw error;
                    }),
            );
        });

    const results = await Promise.allSettled(permissionUpdates);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length) {
        const err = new Error(
            `applyTicketParticipantPermissions: ${failures.length}/${results.length} channel permission update(s) failed for ticket ${ticketId}`,
        );
        err.cause = failures[0].reason;
        err.discordCode = failures[0].reason?.code;
        console.error(err.message, { discordCode: err.discordCode, canManagePermissions });
        throw err;
    }
}
