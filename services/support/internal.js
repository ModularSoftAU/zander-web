/**
 * services/support/internal.js
 *
 * Shared internals for the support-ticket service modules: the one-shot schema
 * guards (each lazily ADDs a missing column / table the first time it's needed
 * and caches the promise), the notification fan-out helper, and the avatar-URL
 * builder. Used across more than one concern module and by
 * controllers/supportTicketController.js's siblings — NOT part of the public API,
 * so it is deliberately not re-exported from the controller barrel.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 */

import db from "../../controllers/databaseController.js";
import { hashEmail } from "../../api/common.js";
import { createNotificationsForUsers } from "../../controllers/notificationController.js";
// Runtime-only imports (called inside notifyTicketParticipants, never at module
// init) — these cycles are safe under ESM.
import { getTicketById } from "./tickets.js";
import { getTicketParticipants } from "./participants.js";

let discordChannelColumnCheck;
let ticketParticipantTableCheck;
let ticketMessageInternalColumnCheck;
let ticketLockColumnCheck;
let ticketEscalationColumnCheck;
let ticketMessageTypeColumnCheck;

const MAX_NOTIFICATION_MESSAGE_LENGTH = 160;

export function buildTicketNotificationTarget(ticket) {
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

export function trimNotificationMessage(message) {
    const normalized = String(message || "").trim();
    if (!normalized) {
        return "View the update for details.";
    }

    if (normalized.length <= MAX_NOTIFICATION_MESSAGE_LENGTH) {
        return normalized;
    }

    return `${normalized.slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH - 3)}...`;
}

export async function notifyTicketParticipants({ ticket, ticketId, actorUserId, notificationType, title, message }) {
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

export async function ensureDiscordChannelColumn() {
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

export async function ensureTicketParticipantTable() {
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

export async function ensureTicketMessageInternalColumn() {
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

export async function ensureTicketLockColumn() {
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

export async function ensureTicketEscalationColumn() {
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

export async function ensureTicketMessageTypeColumn() {
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

/**
 * Build an avatar URL for a user row / profile, honouring their configured
 * profile-picture source. Returns null when no avatar can be derived.
 */
export async function buildAvatarUrl(profile) {
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
