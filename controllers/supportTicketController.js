import config from "../config.json" assert { type: "json" };
import db from "./databaseController.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";

let discordChannelColumnCheck;
let ticketParticipantTableCheck;

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
        targetParentId =
            config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID ?? null;
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
        channelCreationOptions.parent = targetParentId;
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

    return new Promise((resolve, reject) => {
        db.query(
            "INSERT IGNORE INTO supportTicketParticipants (ticketId, roleId, rankSlug, roleName, badgeColor, textColor) VALUES (?, ?, ?, ?, ?, ?)",
            [ticketId, group.id, group.rankSlug, group.name, group.badgeColor, group.textColor],
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
        (rank) => discordRoleIds.includes(rank.id) || rankSlugs.includes(rank.rankSlug),
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

    participants.users
        .filter((user) => user.discordId)
        .forEach((user) => {
            permissionUpdates.push(
                channel.permissionOverwrites.edit(user.discordId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    ReadMessageHistory: true,
                }),
            );
        });

    participants.groups.forEach((group) => {
        permissionUpdates.push(
            channel.permissionOverwrites.edit(group.roleId, {
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

export async function createSupportTicketMessage(client, ticketId, userId, message, attachmentUrl = null, source = "web") {
    if (source === "web") {
        try {
            const ticket = await getTicketById(ticketId);
            if (!ticket?.discordChannelId) {
                console.warn("No Discord channel stored for ticket", ticketId);
            } else if (!client) {
                console.warn("Discord client unavailable; skipping channel post for web reply", ticketId);
            } else {
                let channel;
                try {
                    channel = await client.channels.fetch(ticket.discordChannelId);
                } catch (error) {
                    console.error("Failed to fetch Discord channel for ticket", ticketId, error);
                }

                if (channel) {
                    let content = `**User ${userId} said:**\n${message}`;
                    if (attachmentUrl) {
                        content += `\n\n**Attachment:** ${attachmentUrl}`;
                    }

                    try {
                        await channel.send(content);
                    } catch (error) {
                        console.error("Failed to send web reply to Discord channel", ticketId, error);
                    }
                }
            }
        } catch (error) {
            console.error("createSupportTicketMessage: failed to post to Discord", error);
        }
    }

    return new Promise((resolve, reject) => {
        db.query(
        "INSERT INTO supportTicketMessages (ticketId, userId, message, attachments) VALUES (?, ?, ?, ?)",
        [ticketId, userId, message, JSON.stringify([attachmentUrl])],
        (err, results) => {
            if (err) reject(err);
            resolve(results.insertId);
        }
        );
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
            "SELECT userId, username, discordId FROM users WHERE username = ? OR userId = ? LIMIT 1",
            [lookup, lookup],
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

export async function getTicketMessages(ticketId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT m.*, u.username FROM supportTicketMessages m JOIN users u ON m.userId = u.userId WHERE m.ticketId = ?", [ticketId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
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
