import config from "../config.json" assert { type: "json" };
import db from "./databaseController.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { hashEmail } from "../api/common.js";
import { createNotificationsForUsers } from "./notificationController.js";

let discordChannelColumnCheck;
let ticketParticipantTableCheck;
let ticketMessageInternalColumnCheck;
let ticketLockColumnCheck;
let ticketEscalationColumnCheck;
let ticketMessageTypeColumnCheck;
let ticketCategoryDiscordColumnCheck;

const MAX_NOTIFICATION_MESSAGE_LENGTH = 160;

function buildTicketNotificationTarget(ticket) {
    if (!ticket) {
        return {
            label: "Ticket",
            targetType: "ticket",
            url: "/support",
        };
    }

    const match = String(ticket.title || "").match(/Appeal #([^\s]+)/i);
    const label = match ? `Appeal #${match[1]}` : `Ticket #${ticket.ticketId}`;
    const targetType = match ? "appeal" : "ticket";
    const url = `/support/ticket/${ticket.ticketId}`;

    return { label, targetType, url };
}

function trimNotificationMessage(message) {
    const normalized = String(message || "").trim();
    if (!normalized) {
        return "View the update for details.";
    }

    if (normalized.length <= MAX_NOTIFICATION_MESSAGE_LENGTH) {
        return normalized;
    }

    return `${normalized.slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH - 3)}...`;
}

async function notifyTicketParticipants({ ticket, ticketId, actorUserId, notificationType, title, message }) {
    const ticketRecord = ticket || (ticketId ? await getTicketById(ticketId) : null);
    if (!ticketRecord) return;

    const participants = await getTicketParticipants(ticketRecord.ticketId);
    const userIds = new Set([ticketRecord.userId, ...participants.users.map((user) => user.userId)]);

    if (actorUserId) {
        userIds.delete(actorUserId);
    }

    if (!userIds.size) return;

    const target = buildTicketNotificationTarget(ticketRecord);

    try {
        await createNotificationsForUsers([...userIds], {
            ticketId: ticketRecord.ticketId,
            notificationType,
            title,
            message,
            url: target.url,
        });
    } catch (error) {
        console.error("Failed to send ticket notifications", error);
    }
}

async function ensureDiscordChannelColumn() {
    if (!discordChannelColumnCheck) {
        discordChannelColumnCheck = new Promise((resolve) => {
            db.query("SHOW COLUMNS FROM supportTickets LIKE 'discordChannelId'", (err, results) => {
                if (err) {
                    console.error("Failed to verify supportTickets.discordChannelId column", err);
                    resolve(false);
                    return;
                }

                if (results.length > 0) {
                    resolve(true);
                    return;
                }

                db.query("ALTER TABLE supportTickets ADD COLUMN discordChannelId VARCHAR(255)", (alterErr) => {
                    if (alterErr) {
                        console.error("Failed to add missing supportTickets.discordChannelId column", alterErr);
                        resolve(false);
                        return;
                    }

                    console.info("Added missing supportTickets.discordChannelId column for Discord ticket linking");
                    resolve(true);
                });
            });
        });
    }

    return discordChannelColumnCheck;
}

async function ensureTicketParticipantTable() {
    if (!ticketParticipantTableCheck) {
        ticketParticipantTableCheck = new Promise((resolve) => {
            db.query(
                "CREATE TABLE IF NOT EXISTS supportTicketParticipants (\n                  participantId INT AUTO_INCREMENT PRIMARY KEY,\n                  ticketId INT NOT NULL,\n                  userId INT NULL,\n                  roleId VARCHAR(255) NULL,\n                  rankSlug VARCHAR(255) NULL,\n                  roleName VARCHAR(255) NULL,\n                  badgeColor VARCHAR(255) NULL,\n                  textColor VARCHAR(255) NULL,\n                  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n                  UNIQUE KEY ticket_user_unique (ticketId, userId),\n                  UNIQUE KEY ticket_role_unique (ticketId, roleId),\n                  FOREIGN KEY (ticketId) REFERENCES supportTickets(ticketId) ON DELETE CASCADE\n                )",
                (err) => {
                    if (err) {
                        console.error("Failed to ensure supportTicketParticipants table", err);
                        resolve(false);
                        return;
                    }

                    resolve(true);
                },
            );
        });
    }

    return ticketParticipantTableCheck;
}

async function ensureTicketMessageInternalColumn() {
    if (!ticketMessageInternalColumnCheck) {
        ticketMessageInternalColumnCheck = new Promise((resolve) => {
            db.query("SHOW COLUMNS FROM supportTicketMessages LIKE 'isInternal'", (err, results) => {
                if (err) {
                    console.error("Failed to verify supportTicketMessages.isInternal column", err);
                    resolve(false);
                    return;
                }

                if (results.length > 0) {
                    resolve(true);
                    return;
                }

                db.query(
                    "ALTER TABLE supportTicketMessages ADD COLUMN isInternal TINYINT(1) NOT NULL DEFAULT 0",
                    (alterErr) => {
                        if (alterErr) {
                            console.error(
                                "Failed to add missing supportTicketMessages.isInternal column",
                                alterErr,
                            );
                            resolve(false);
                            return;
                        }

                        console.info(
                            "Added missing supportTicketMessages.isInternal column for reply visibility",
                        );
                        resolve(true);
                    },
                );
            });
        });
    }

    return ticketMessageInternalColumnCheck;
}

async function ensureTicketLockColumn() {
    if (!ticketLockColumnCheck) {
        ticketLockColumnCheck = new Promise((resolve) => {
            db.query("SHOW COLUMNS FROM supportTickets LIKE 'isLocked'", (err, results) => {
                if (err) {
                    console.error("Failed to verify supportTickets.isLocked column", err);
                    resolve(false);
                    return;
                }

                if (results.length > 0) {
                    resolve(true);
                    return;
                }

                db.query(
                    "ALTER TABLE supportTickets ADD COLUMN isLocked TINYINT(1) NOT NULL DEFAULT 0",
                    (alterErr) => {
                        if (alterErr) {
                            console.error("Failed to add supportTickets.isLocked column", alterErr);
                            resolve(false);
                            return;
                        }

                        console.info("Added supportTickets.isLocked column for ticket locking");
                        resolve(true);
                    },
                );
            });
        });
    }

    return ticketLockColumnCheck;
}

async function ensureTicketEscalationColumn() {
    if (!ticketEscalationColumnCheck) {
        ticketEscalationColumnCheck = new Promise((resolve) => {
            db.query("SHOW COLUMNS FROM supportTickets LIKE 'isEscalated'", (err, results) => {
                if (err) {
                    console.error("Failed to verify supportTickets.isEscalated column", err);
                    resolve(false);
                    return;
                }

                if (results.length > 0) {
                    resolve(true);
                    return;
                }

                db.query(
                    "ALTER TABLE supportTickets ADD COLUMN isEscalated TINYINT(1) NOT NULL DEFAULT 0",
                    (alterErr) => {
                        if (alterErr) {
                            console.error("Failed to add supportTickets.isEscalated column", alterErr);
                            resolve(false);
                            return;
                        }

                        console.info("Added supportTickets.isEscalated column for ticket escalation");
                        resolve(true);
                    },
                );
            });
        });
    }

    return ticketEscalationColumnCheck;
}

async function ensureTicketMessageTypeColumn() {
    if (!ticketMessageTypeColumnCheck) {
        ticketMessageTypeColumnCheck = new Promise((resolve) => {
            db.query("SHOW COLUMNS FROM supportTicketMessages LIKE 'messageType'", (err, results) => {
                if (err) {
                    console.error("Failed to verify supportTicketMessages.messageType column", err);
                    resolve(false);
                    return;
                }

                if (results.length > 0) {
                    resolve(true);
                    return;
                }

                db.query(
                    "ALTER TABLE supportTicketMessages ADD COLUMN messageType VARCHAR(32) NOT NULL DEFAULT 'message' AFTER message",
                    (alterErr) => {
                        if (alterErr) {
                            console.error("Failed to add supportTicketMessages.messageType column", alterErr);
                            resolve(false);
                            return;
                        }

                        console.info("Added supportTicketMessages.messageType column for status events");
                        resolve(true);
                    },
                );
            });
        });
    }

    return ticketMessageTypeColumnCheck;
}

async function ensureTicketCategoryDiscordColumn() {
    if (!ticketCategoryDiscordColumnCheck) {
        ticketCategoryDiscordColumnCheck = new Promise((resolve) => {
            db.query(
                "SHOW COLUMNS FROM supportTicketCategories LIKE 'discordCategoryId'",
                (err, results) => {
                    if (err) {
                        console.error(
                            "Failed to verify supportTicketCategories.discordCategoryId column",
                            err,
                        );
                        resolve(false);
                        return;
                    }

                    if (results.length > 0) {
                        resolve(true);
                        return;
                    }

                    db.query(
                        "ALTER TABLE supportTicketCategories ADD COLUMN discordCategoryId VARCHAR(255) NULL",
                        (alterErr) => {
                            if (alterErr) {
                                console.error(
                                    "Failed to add supportTicketCategories.discordCategoryId column",
                                    alterErr,
                                );
                                resolve(false);
                                return;
                            }

                            console.info(
                                "Added supportTicketCategories.discordCategoryId column for Discord category mapping",
                            );
                            resolve(true);
                        },
                    );
                },
            );
        });
    }

    return ticketCategoryDiscordColumnCheck;
}

async function buildAvatarUrl(profile) {
    if (!profile) return null;

    try {
        if (profile.profilePicture_type === "GRAVATAR" && profile.profilePicture_email) {
            const emailHash = await hashEmail(profile.profilePicture_email);
            return `https://gravatar.com/avatar/${emailHash}?size=200`;
        }

        if (profile.profilePicture_type === "CRAFTATAR" && profile.uuid) {
            return `https://crafthead.net/helm/${profile.uuid}`;
        }
    } catch (avatarError) {
        console.error("buildAvatarUrl: failed to build avatar", avatarError);
    }

    return null;
}


export async function getSupportCategories() {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM supportTicketCategories", (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
  });
}

export async function getCategoryDiscordParentId(categoryId) {
    const hasColumn = await ensureTicketCategoryDiscordColumn();
    if (!hasColumn || !categoryId) return null;

    return new Promise((resolve) => {
        db.query(
            "SELECT discordCategoryId FROM supportTicketCategories WHERE categoryId = ? LIMIT 1",
            [categoryId],
            (err, results) => {
                if (err) {
                    console.error("getCategoryDiscordParentId: failed to lookup category", err);
                    resolve(null);
                    return;
                }

                const discordCategoryId = results?.[0]?.discordCategoryId;
                const normalized = discordCategoryId ? String(discordCategoryId).trim() : "";
                if (!/^\d{5,}$/.test(normalized)) {
                    resolve(null);
                    return;
                }

                resolve(normalized);
            },
        );
    });
}

export async function ensureUncategorisedCategory() {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT categoryId FROM supportTicketCategories WHERE name = ? LIMIT 1",
      ["Uncategorised"],
      (lookupErr, results) => {
        if (lookupErr) return reject(lookupErr);

        if (results.length > 0) {
          return resolve(results[0].categoryId);
        }

        db.query(
          "INSERT INTO supportTicketCategories (name, description, enabled) VALUES (?, ?, 0)",
          ["Uncategorised", "Manual tickets created by staff"],
          (insertErr, insertResults) => {
            if (insertErr) return reject(insertErr);
            resolve(insertResults.insertId);
          }
        );
      }
    );
  });
}

export async function getSupportCategoriesWithPermissions() {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT c.*, GROUP_CONCAT(p.roleId) as permissions FROM supportTicketCategories c LEFT JOIN supportTicketCategoryPermissions p ON c.categoryId = p.categoryId GROUP BY c.categoryId",
      (err, results) => {
        if (err) reject(err);
        resolve(results);
      }
    );
  });
}

export async function getCategoryName(categoryId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT name FROM supportTicketCategories WHERE categoryId = ?",
      [categoryId],
      (err, results) => {
        if (err) reject(err);
        resolve(results[0] ? results[0].name : "");
      }
    );
  });
}

export async function addCategoryPermission(categoryId, roleId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT 1 FROM supportTicketCategoryPermissions WHERE categoryId = ? AND roleId = ? LIMIT 1",
      [categoryId, roleId],
      (existingErr, existingResults) => {
        if (existingErr) return reject(existingErr);

        if (existingResults.length > 0) {
          return resolve({ alreadyExists: true });
        }

        db.query(
          "INSERT INTO supportTicketCategoryPermissions (categoryId, roleId) VALUES (?, ?)",
          [categoryId, roleId],
          (err, results) => {
            if (err) reject(err);
            resolve(results);
          }
        );
      }
    );
  });
}

export async function removeCategoryPermission(categoryId, roleId) {
    return new Promise((resolve, reject) => {
        db.query(
            "DELETE FROM supportTicketCategoryPermissions WHERE categoryId = ? AND roleId = ?",
            [categoryId, roleId],
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

export async function createSupportCategory(name, description) {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO supportTicketCategories (name, description) VALUES (?, ?)",
      [name, description],
      (err, results) => {
        if (err) reject(err);
        resolve(results);
      }
    );
  });
}

export async function getLuckPermRankRoles() {
    try {
        const ranks = await new Promise((resolve, reject) => {
            db.query(
                "SELECT rankSlug, displayName, discordRoleId, rankBadgeColour, rankTextColour FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''",
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results);
                    }
                },
            );
        });

        return ranks.map((rank) => ({
            id: rank.discordRoleId,
            name: rank.displayName || rank.rankSlug,
            rankSlug: rank.rankSlug,
            badgeColor: rank.rankBadgeColour,
            textColor: rank.rankTextColour,
        }));
    } catch (error) {
        console.error("getLuckPermRankRoles: failed to fetch rank Discord role mappings", error);
        return [];
    }
}

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

    let targetParentId = null;

    if (parentCategoryId !== false) {
        targetParentId =
            parentCategoryId && parentCategoryId !== "undefined" && parentCategoryId !== ""
                ? parentCategoryId
                : null;

        if (!targetParentId) {
            try {
                targetParentId = await getCategoryDiscordParentId(categoryId);
            } catch (categoryError) {
                console.error("Failed to resolve category Discord parent", categoryError);
            }
        }

        if (!targetParentId) {
            targetParentId =
                config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;
        }
    }
    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
    ];

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

    const channelCreationOptions = {
        name: "ticket-pending",
        type: ChannelType.GuildText,
        permissionOverwrites,
        reason: `Support ticket for ${discordUserId ?? `user ${userId}`}`,
    };

    if (targetParentId) {
        try {
            const parentChannel = await guild.channels.fetch(targetParentId);
            if (parentChannel?.type === ChannelType.GuildCategory) {
                channelCreationOptions.parent = parentChannel.id;
            } else {
                console.warn("Configured ticket parent is not a category; creating channel without parent");
            }
        } catch (parentError) {
            console.error("Failed to fetch configured ticket parent category", parentError);
        }
    }

    const channel = await guild.channels.create(channelCreationOptions);

    const hasChannelColumn = await ensureDiscordChannelColumn();

    return new Promise((resolve, reject) => {
        const query = hasChannelColumn
            ? "INSERT INTO supportTickets (userId, categoryId, title, discordChannelId) VALUES (?, ?, ?, ?)"
            : "INSERT INTO supportTickets (userId, categoryId, title) VALUES (?, ?, ?)";
        const params = hasChannelColumn
            ? [userId, categoryId, title, channel.id]
            : [userId, categoryId, title];

        db.query(query, params, async (err, results) => {
            if (err) {
                try {
                    await channel.delete("Failed to persist support ticket");
                } catch (cleanupError) {
                    console.error("Failed to clean up orphaned ticket channel", cleanupError);
                }
                reject(err);
                return;
            }

            const ticketId = results.insertId;

            try {
                await channel.setName(`ticket-${ticketId}`);
            } catch (renameError) {
                console.error("Failed to rename ticket channel", renameError);
            }

            resolve({ ticketId, channel });
        });
    });
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

    let resolvedParentId =
        parentCategoryId && parentCategoryId !== "undefined" && parentCategoryId !== ""
            ? parentCategoryId
            : null;

    if (!resolvedParentId) {
        try {
            resolvedParentId = await getCategoryDiscordParentId(ticket.categoryId);
        } catch (categoryError) {
            console.error("recreateTicketChannel: failed to resolve category Discord parent", categoryError);
        }
    }

    if (!resolvedParentId) {
        resolvedParentId =
            config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;
    }

    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
    ];

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

    if (resolvedParentId) {
        try {
            const parentChannel = await guild.channels.fetch(resolvedParentId);
            if (parentChannel?.type === ChannelType.GuildCategory) {
                channelOptions.parent = parentChannel.id;
            } else {
                console.warn("Configured ticket parent is not a category during reopen; creating without parent");
            }
        } catch (parentError) {
            console.error("Failed to fetch configured ticket parent category during reopen", parentError);
        }
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

export async function syncParticipantsForMessage(client, ticketId, { userId, discordRoleIds = [], rankSlugs = [] }) {
    const rankOptions = await getLuckPermRankRoles();
    const newParticipantPromises = [];

    if (userId && !(await hasExistingUserParticipant(ticketId, userId))) {
        newParticipantPromises.push(addTicketUserParticipant(ticketId, { userId }));
    }

    const eligibleRanks = rankOptions.filter(
        (rank) =>
            rank.id &&
            /^\d{5,}$/.test(rank.id) &&
            (discordRoleIds.includes(rank.id) || rankSlugs.includes(rank.rankSlug)),
    );

    for (const rank of eligibleRanks) {
        const exists = await hasExistingGroupParticipant(ticketId, rank.id);
        if (!exists) {
            newParticipantPromises.push(addTicketGroupParticipant(ticketId, rank));
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

    participants.users
        .map((user) => (user.discordId ? String(user.discordId).trim() : ""))
        .filter((id) => isSnowflake(id))
        .forEach((discordId) => {
            permissionUpdates.push(
                channel.permissionOverwrites.edit(discordId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    ReadMessageHistory: true,
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
            permissionUpdates.push(
                channel.permissionOverwrites.edit(roleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    ReadMessageHistory: true,
                }),
            );
        });

    try {
        await Promise.all(permissionUpdates);
    } catch (error) {
        console.error("applyTicketParticipantPermissions: failed to update channel permissions", error);
    }
}

export async function deleteTicketChannel(client, ticketId, reason = "Ticket closed") {
    const hasChannelColumn = await ensureDiscordChannelColumn();
    if (!hasChannelColumn) {
        return false;
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket?.discordChannelId) {
        return false;
    }

    if (!client) {
        console.warn("deleteTicketChannel: Discord client unavailable; skipping channel removal", { ticketId });
    } else {
        try {
            const channel = await client.channels.fetch(ticket.discordChannelId);
            if (channel) {
                await channel.delete(reason);
            }
        } catch (error) {
            console.error("deleteTicketChannel: failed to delete Discord channel", {
                ticketId,
                channelId: ticket.discordChannelId,
            }, error);
        }
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

export async function getUserIdByDiscordId(discordId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT userId FROM users WHERE discordId = ?", [discordId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0] ? results[0].userId : null);
            }
        });
    });
}

export async function getCategoryById(id) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM supportTicketCategories WHERE categoryId = ?", [id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
}

export async function getCategoryPermissions(categoryId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT roleId FROM supportTicketCategoryPermissions WHERE categoryId = ?",
            [categoryId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.map((row) => row.roleId));
                }
            }
        );
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
                channel.permissionOverwrites.edit(roleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    ReadMessageHistory: true,
                    ManageMessages: true,
                }),
            );
        });

    try {
        await Promise.all(permissionPromises);
    } catch (permissionError) {
        console.error("updateTicketCategory: failed to update Discord permissions", permissionError);
    }

    return { changed: true, previousCategoryId, nextCategoryId: newCategoryId };
}

export async function getUserById(userId) {
    if (!userId) return null;

    return new Promise((resolve) => {
        db.query(
            "SELECT userId, username, discordId, profilePicture_type, profilePicture_email, uuid FROM users WHERE userId = ? LIMIT 1",
            [userId],
            (err, results) => {
                if (err) {
                    console.error("getUserById: failed to lookup user", err);
                    resolve(null);
                } else {
                    resolve(results?.[0] || null);
                }
            },
        );
    });
}

export async function findUserByIdentifier(identifier) {
    const lookup = identifier?.trim();
    if (!lookup) return null;

    return new Promise((resolve, reject) => {
        db.query(
            "SELECT userId, username, discordId FROM users WHERE LOWER(username) = LOWER(?) OR userId = ? OR discordId = ? LIMIT 1",
            [lookup, lookup, lookup],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results[0] || null);
                }
            },
        );
    });
}

export async function updateSupportCategory(id, name, description) {
    return new Promise((resolve, reject) => {
        db.query("UPDATE supportTicketCategories SET name = ?, description = ? WHERE categoryId = ?", [name, description, id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export async function searchUsersByUsername(query) {
    const term = query?.trim();
    if (!term || term.length < 2) return [];

    return new Promise((resolve) => {
        db.query(
            "SELECT userId, username, profilePicture_type, profilePicture_email, uuid FROM users WHERE username LIKE ? ORDER BY username ASC LIMIT 8",
            [`${term}%`],
            async (err, results) => {
                if (err) {
                    console.error("searchUsersByUsername: failed to run query", err);
                    resolve([]);
                    return;
                }

                const enriched = await Promise.all(
                    results.map(async (row) => ({
                        ...row,
                        avatarUrl: await buildAvatarUrl(row),
                    })),
                );
                resolve(enriched);
            },
        );
    });
}

export async function createUnlinkedUser(discordId, username) {
    return new Promise((resolve, reject) => {
        db.query("INSERT INTO users (discordId, username, uuid) VALUES (?, ?, UUID())", [discordId, username], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results.insertId);
            }
        });
    });
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
        userRanks = await new Promise((resolve) => {
            db.query(
                `SELECT ur.userId, ur.rankSlug, r.displayName, r.rankBadgeColour, r.rankTextColour, r.priority
                 FROM userRanks ur
                 LEFT JOIN ranks r ON ur.rankSlug = r.rankSlug
                 WHERE ur.userId IN (?)
                 ORDER BY CAST(r.priority AS SIGNED) DESC`,
                [uniqueUserIds],
                (err, results) => {
                    if (err) {
                        console.error("Failed to load ranks for ticket messages", err);
                        resolve({});
                        return;
                    }

                    const grouped = {};
                    results.forEach((row) => {
                        if (!grouped[row.userId]) grouped[row.userId] = [];
                        grouped[row.userId].push({
                            rankSlug: row.rankSlug,
                            displayName: row.displayName || row.rankSlug,
                            badgeColor: row.rankBadgeColour,
                            textColor: row.rankTextColour,
                            priority: Number(row.priority) || 0,
                        });
                    });
                    Object.values(grouped).forEach((ranks) => {
                        ranks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                    });
                    resolve(grouped);
                },
            );
        });
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
            "SELECT t.*, u.discordId FROM supportTickets t JOIN users u ON t.userId = u.userId WHERE t.discordChannelId = ?",
            [channelId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
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

export async function getUserRoles(userId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT discordRoleId FROM userRanks WHERE userId = ?", [userId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results.map(r => r.discordRoleId));
            }
        });
    });
}

export async function getUserRankSlugs(userId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT rankSlug FROM userRanks WHERE userId = ?",
            [userId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.map((r) => r.rankSlug));
                }
            },
        );
    });
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

export async function deleteSupportCategory(id) {
    return new Promise((resolve, reject) => {
        db.query("DELETE FROM supportTicketCategories WHERE categoryId = ?", [id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}
