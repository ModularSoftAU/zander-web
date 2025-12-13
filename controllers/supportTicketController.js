import db from "./databaseController.js";
import { ChannelType } from "discord.js";

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
      "INSERT INTO supportTicketCategoryPermissions (categoryId, roleId) VALUES (?, ?)",
      [categoryId, roleId],
      (err, results) => {
        if (err) reject(err);
        resolve(results);
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

export async function createSupportTicket(client, userId, categoryId, title) {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const channel = await guild.channels.create({
        name: `ticket-${title}`,
        type: ChannelType.GuildText,
        parent: process.env.SUPPORT_CATEGORY_ID,
    });

    return new Promise((resolve, reject) => {
        db.query(
        "INSERT INTO supportTickets (userId, categoryId, title, discordChannelId) VALUES (?, ?, ?, ?)",
        [userId, categoryId, title, channel.id],
        (err, results) => {
            if (err) reject(err);
            resolve(results.insertId);
        }
        );
    });
}

export async function createSupportTicketMessage(client, ticketId, userId, message, attachmentUrl = null, source = "web") {
    if (source === "web") {
        const ticket = await getTicketById(ticketId);
        const channel = await client.channels.fetch(ticket.discordChannelId);

        let content = `**User ${userId} said:**\n${message}`;
        if (attachmentUrl) {
            content += `\n\n**Attachment:** ${attachmentUrl}`;
        }

        await channel.send(content);
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

export async function getAllTickets() {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM supportTickets", (err, results) => {
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

export async function getCategoryPermissions(categoryId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT roleId FROM supportTicketCategoryPermissions WHERE categoryId = ?", [categoryId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results.map(r => r.roleId));
            }
        });
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
