import config from "../config.json" assert { type: "json" };
import db from "./databaseController.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { hashEmail } from "../api/common.js";

let discordChannelColumnCheck;
let ticketParticipantTableCheck;
let ticketMessageInternalColumnCheck;

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


export async function getSupportCategories() {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM supportTicketCategories", (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
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

    let targetParentId =
        parentCategoryId && parentCategoryId !== "undefined" && parentCategoryId !== ""
            ? parentCategoryId
            : null;

    if (!targetParentId) {
        targetParentId = config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;
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
    console.info("createSupportTicketMessage invoked", {
        ticketId,
        userId,
        source,
        messageLength: message?.length ?? 0,
        isInternal,
    });

    const hasInternalColumn = await ensureTicketMessageInternalColumn();

    if (source === "web" && !isInternal) {
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

                    let avatarUrl = null;
                    if (senderProfile) {
                        try {
                            if (senderProfile.profilePicture_type === "GRAVATAR" && senderProfile.profilePicture_email) {
                                const emailHash = await hashEmail(senderProfile.profilePicture_email);
                                avatarUrl = `https://gravatar.com/avatar/${emailHash}?size=200`;
                            } else if (senderProfile.profilePicture_type === "CRAFTATAR" && senderProfile.uuid) {
                                avatarUrl = `https://crafthead.net/helm/${senderProfile.uuid}`;
                            }
                        } catch (avatarError) {
                            console.error("createSupportTicketMessage: failed to build avatar for sender", avatarError);
                        }
                    }

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
        const insertQuery = hasInternalColumn
            ? "INSERT INTO supportTicketMessages (ticketId, userId, message, attachments, isInternal) VALUES (?, ?, ?, ?, ?)"
            : "INSERT INTO supportTicketMessages (ticketId, userId, message, attachments) VALUES (?, ?, ?, ?)";
        const params = hasInternalColumn
            ? [ticketId, userId, message, JSON.stringify([]), isInternal ? 1 : 0]
            : [ticketId, userId, message, JSON.stringify([])];

        db.query(insertQuery, params, (err, results) => {
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
            resolve(results.insertId);
        });
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
    const baseMessages = await new Promise((resolve, reject) => {
        const internalSelect = hasInternalColumn ? "" : ", 0 as isInternal";
        db.query(
            `SELECT m.*, u.username, u.discordId, u.profilePicture_type, u.profilePicture_email, u.uuid${internalSelect} FROM supportTicketMessages m JOIN users u ON m.userId = u.userId WHERE m.ticketId = ? ORDER BY m.createdAt ASC`,
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

    if (uniqueUserIds.length > 0) {
        userRanks = await new Promise((resolve) => {
            db.query(
                `SELECT ur.userId, ur.rankSlug, r.displayName, r.rankBadgeColour, r.rankTextColour
                 FROM userRanks ur
                 LEFT JOIN ranks r ON ur.rankSlug = r.rankSlug
                 WHERE ur.userId IN (?)`,
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
                        });
                    });
                    resolve(grouped);
                },
            );
        });
    }

    const resolvedMessages = [];

    for (const message of filteredMessages) {
        let avatarUrl = null;
        try {
            if (message.profilePicture_type === "GRAVATAR" && message.profilePicture_email) {
                const emailHash = await hashEmail(message.profilePicture_email);
                avatarUrl = `https://gravatar.com/avatar/${emailHash}?size=200`;
            } else if (message.profilePicture_type === "CRAFTATAR" && message.uuid) {
                avatarUrl = `https://crafthead.net/helm/${message.uuid}`;
            }
        } catch (avatarError) {
            console.error("Failed to build avatar for ticket message", avatarError);
        }

        resolvedMessages.push({
            ...message,
            avatarUrl,
            ranks: userRanks[message.userId] || [],
            isInternal: Boolean(message.isInternal),
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
