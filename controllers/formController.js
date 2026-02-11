import db from "./databaseController.js";

// ─── Form CRUD ───

export function getFormById(formId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT * FROM forms WHERE formId = ? LIMIT 1",
            [formId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results[0] || null);
            }
        );
    });
}

export function getFormBySlug(slug) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT * FROM forms WHERE slug = ? LIMIT 1",
            [slug],
            (err, results) => {
                if (err) return reject(err);
                resolve(results[0] || null);
            }
        );
    });
}

export function getAllForms() {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT * FROM forms ORDER BY createdAt DESC",
            (err, results) => {
                if (err) return reject(err);
                resolve(results || []);
            }
        );
    });
}

export function getPublishedForms() {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT * FROM forms WHERE status = 'published' ORDER BY name ASC",
            (err, results) => {
                if (err) return reject(err);
                resolve(results || []);
            }
        );
    });
}

export function createForm({ name, slug, status, createdByUserId, discordWebhookUrl, discordForumChannelId, postToForumEnabled, webhookEnabled, submitterCanView, requireLogin }) {
    return new Promise((resolve, reject) => {
        db.query(
            `INSERT INTO forms (name, slug, status, createdByUserId, discordWebhookUrl, discordForumChannelId, postToForumEnabled, webhookEnabled, submitterCanView, requireLogin)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, slug, status || "draft", createdByUserId, discordWebhookUrl || null, discordForumChannelId || null, postToForumEnabled ? 1 : 0, webhookEnabled ? 1 : 0, submitterCanView ? 1 : 0, requireLogin ? 1 : 0],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function updateForm(formId, { name, slug, status, discordWebhookUrl, discordForumChannelId, postToForumEnabled, webhookEnabled, submitterCanView, requireLogin }) {
    return new Promise((resolve, reject) => {
        db.query(
            `UPDATE forms SET name=?, slug=?, status=?, discordWebhookUrl=?, discordForumChannelId=?, postToForumEnabled=?, webhookEnabled=?, submitterCanView=?, requireLogin=? WHERE formId=?`,
            [name, slug, status, discordWebhookUrl || null, discordForumChannelId || null, postToForumEnabled ? 1 : 0, webhookEnabled ? 1 : 0, submitterCanView ? 1 : 0, requireLogin ? 1 : 0, formId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function updateFormStatus(formId, status) {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE forms SET status=? WHERE formId=?",
            [status, formId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function deleteForm(formId) {
    return new Promise((resolve, reject) => {
        // Check if form has responses
        db.query(
            "SELECT COUNT(*) as count FROM formResponses WHERE formId = ?",
            [formId],
            (err, results) => {
                if (err) return reject(err);
                if (results[0].count > 0) {
                    return reject(new Error("Cannot delete a form that has responses. Archive it instead."));
                }
                db.query(
                    "DELETE FROM forms WHERE formId = ?",
                    [formId],
                    (err2, results2) => {
                        if (err2) return reject(err2);
                        resolve(results2);
                    }
                );
            }
        );
    });
}

// ─── Form Blocks ───

export function getFormBlocks(formId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT * FROM formBlocks WHERE formId = ? ORDER BY orderIndex ASC",
            [formId],
            (err, results) => {
                if (err) return reject(err);
                // Parse config JSON for each block
                const blocks = (results || []).map((block) => {
                    if (block.config && typeof block.config === "string") {
                        try {
                            block.config = JSON.parse(block.config);
                        } catch (_) {
                            block.config = {};
                        }
                    }
                    return block;
                });
                resolve(blocks);
            }
        );
    });
}

export function createFormBlock(formId, { type, orderIndex, required, label, description, config }) {
    return new Promise((resolve, reject) => {
        const configJson = config ? JSON.stringify(config) : null;
        db.query(
            `INSERT INTO formBlocks (formId, type, orderIndex, \`required\`, label, description, config)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [formId, type, orderIndex || 0, required ? 1 : 0, label || null, description || null, configJson],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function updateFormBlock(blockId, { type, orderIndex, required, label, description, config }) {
    return new Promise((resolve, reject) => {
        const configJson = config ? JSON.stringify(config) : null;
        db.query(
            "UPDATE formBlocks SET type=?, orderIndex=?, `required`=?, label=?, description=?, config=? WHERE blockId=?",
            [type, orderIndex, required ? 1 : 0, label || null, description || null, configJson, blockId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function deleteFormBlock(blockId) {
    return new Promise((resolve, reject) => {
        db.query(
            "DELETE FROM formBlocks WHERE blockId = ?",
            [blockId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function replaceFormBlocks(formId, blocks) {
    return new Promise((resolve, reject) => {
        // Delete existing blocks then insert new ones
        db.query(
            "DELETE FROM formBlocks WHERE formId = ?",
            [formId],
            (err) => {
                if (err) return reject(err);

                if (!blocks || blocks.length === 0) {
                    return resolve({ affectedRows: 0 });
                }

                const values = blocks.map((block, index) => [
                    formId,
                    block.type,
                    block.orderIndex !== undefined ? block.orderIndex : index,
                    block.required ? 1 : 0,
                    block.label || null,
                    block.description || null,
                    block.config ? JSON.stringify(block.config) : null,
                ]);

                db.query(
                    "INSERT INTO formBlocks (formId, type, orderIndex, `required`, label, description, config) VALUES ?",
                    [values],
                    (err2, results2) => {
                        if (err2) return reject(err2);
                        resolve(results2);
                    }
                );
            }
        );
    });
}

// ─── Form Responses ───

export function getFormResponses(formId, { status, page, limit } = {}) {
    return new Promise((resolve, reject) => {
        let query = "SELECT r.*, u.username as submitterUsername FROM formResponses r LEFT JOIN users u ON r.submittedByUserId = u.userId WHERE r.formId = ?";
        const params = [formId];

        if (status) {
            query += " AND r.status = ?";
            params.push(status);
        }

        query += " ORDER BY r.submittedAt DESC";

        if (limit) {
            const offset = ((page || 1) - 1) * limit;
            query += " LIMIT ? OFFSET ?";
            params.push(limit, offset);
        }

        db.query(query, params, (err, results) => {
            if (err) return reject(err);
            const responses = (results || []).map((r) => {
                if (r.answers && typeof r.answers === "string") {
                    try {
                        r.answers = JSON.parse(r.answers);
                    } catch (_) {
                        r.answers = {};
                    }
                }
                return r;
            });
            resolve(responses);
        });
    });
}

export function getFormResponseCount(formId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as newCount, SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as convertedCount FROM formResponses WHERE formId = ?",
            [formId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results[0] || { total: 0, newCount: 0, convertedCount: 0 });
            }
        );
    });
}

export function getFormResponseById(responseId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT r.*, u.username as submitterUsername FROM formResponses r LEFT JOIN users u ON r.submittedByUserId = u.userId WHERE r.responseId = ? LIMIT 1",
            [responseId],
            (err, results) => {
                if (err) return reject(err);
                const response = results[0] || null;
                if (response && response.answers && typeof response.answers === "string") {
                    try {
                        response.answers = JSON.parse(response.answers);
                    } catch (_) {
                        response.answers = {};
                    }
                }
                resolve(response);
            }
        );
    });
}

export function getUserFormResponses(userId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT r.*, f.name as formName, f.slug as formSlug FROM formResponses r JOIN forms f ON r.formId = f.formId WHERE r.submittedByUserId = ? ORDER BY r.submittedAt DESC",
            [userId],
            (err, results) => {
                if (err) return reject(err);
                const responses = (results || []).map((r) => {
                    if (r.answers && typeof r.answers === "string") {
                        try {
                            r.answers = JSON.parse(r.answers);
                        } catch (_) {
                            r.answers = {};
                        }
                    }
                    return r;
                });
                resolve(responses);
            }
        );
    });
}

export function createFormResponse(formId, submittedByUserId, answers) {
    return new Promise((resolve, reject) => {
        const answersJson = JSON.stringify(answers);
        db.query(
            "INSERT INTO formResponses (formId, submittedByUserId, answers) VALUES (?, ?, ?)",
            [formId, submittedByUserId || null, answersJson],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function updateFormResponseStatus(responseId, status) {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE formResponses SET status=? WHERE responseId=?",
            [status, responseId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function setResponseDiscordWebhookFailed(responseId) {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE formResponses SET discordWebhookFailed=1 WHERE responseId=?",
            [responseId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function setResponseDiscordForumPostFailed(responseId) {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE formResponses SET discordForumPostFailed=1 WHERE responseId=?",
            [responseId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function setResponseDiscordForumThreadId(responseId, threadId) {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE formResponses SET discordForumThreadId=? WHERE responseId=?",
            [threadId, responseId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

export function setResponseConvertedToTicket(responseId, ticketId, convertedByUserId) {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE formResponses SET status='converted', ticketId=?, convertedByUserId=?, convertedAt=NOW() WHERE responseId=?",
            [ticketId, convertedByUserId, responseId],
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

// ─── Validation ───

export function validateFormSubmission(blocks, answers) {
    const errors = [];

    for (const block of blocks) {
        // Non-question types don't need validation
        if (block.type === "title_description" || block.type === "section_break") {
            continue;
        }

        const answer = answers[block.blockId];
        const config = block.config || {};

        // Required check
        if (block.required) {
            if (answer === undefined || answer === null || answer === "") {
                errors.push({ blockId: block.blockId, message: `"${block.label}" is required.` });
                continue;
            }
            if (Array.isArray(answer) && answer.length === 0) {
                errors.push({ blockId: block.blockId, message: `"${block.label}" is required.` });
                continue;
            }
        }

        // Skip further validation if no answer provided and not required
        if (answer === undefined || answer === null || answer === "") {
            continue;
        }

        switch (block.type) {
            case "short_answer": {
                const val = String(answer);
                if (config.minLength && val.length < config.minLength) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be at least ${config.minLength} characters.` });
                }
                if (config.maxLength && val.length > config.maxLength) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be at most ${config.maxLength} characters.` });
                }
                if (config.validation === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be a valid email address.` });
                }
                if (config.validation === "url" && !/^https?:\/\/.+/.test(val)) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be a valid URL.` });
                }
                break;
            }
            case "paragraph": {
                const val = String(answer);
                if (config.minLength && val.length < config.minLength) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be at least ${config.minLength} characters.` });
                }
                if (config.maxLength && val.length > config.maxLength) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be at most ${config.maxLength} characters.` });
                }
                break;
            }
            case "multiple_choice": {
                const options = config.options || [];
                const allowOther = config.allowOther || false;
                if (!allowOther && !options.includes(answer)) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" has an invalid selection.` });
                }
                break;
            }
            case "checkboxes": {
                if (!Array.isArray(answer)) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be an array of selections.` });
                    break;
                }
                const options = config.options || [];
                const allowOther = config.allowOther || false;
                if (!allowOther) {
                    for (const a of answer) {
                        if (!options.includes(a)) {
                            errors.push({ blockId: block.blockId, message: `"${block.label}" has an invalid selection: "${a}".` });
                            break;
                        }
                    }
                }
                if (config.minSelected && answer.length < config.minSelected) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" requires at least ${config.minSelected} selections.` });
                }
                if (config.maxSelected && answer.length > config.maxSelected) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" allows at most ${config.maxSelected} selections.` });
                }
                break;
            }
            case "dropdown": {
                const options = config.options || [];
                if (!options.includes(answer)) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" has an invalid selection.` });
                }
                break;
            }
            case "linear_scale": {
                const val = Number(answer);
                const min = config.min !== undefined ? config.min : 1;
                const max = config.max !== undefined ? config.max : 5;
                if (isNaN(val) || val < min || val > max) {
                    errors.push({ blockId: block.blockId, message: `"${block.label}" must be between ${min} and ${max}.` });
                }
                break;
            }
        }
    }

    return errors;
}

// ─── Helpers ───

export function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 150);
}

export function formatResponseForDisplay(blocks, answers) {
    const formatted = [];
    for (const block of blocks) {
        if (block.type === "title_description" || block.type === "section_break") {
            continue;
        }
        const answer = answers[block.blockId];
        let displayValue = "";
        if (Array.isArray(answer)) {
            displayValue = answer.join(", ");
        } else if (answer !== undefined && answer !== null) {
            displayValue = String(answer);
        } else {
            displayValue = "(no answer)";
        }
        formatted.push({
            label: block.label || `Question ${block.blockId}`,
            type: block.type,
            value: displayValue,
        });
    }
    return formatted;
}

export function formatResponseForDiscord(blocks, answers, maxLength = 2000) {
    const lines = [];
    for (const block of blocks) {
        if (block.type === "title_description" || block.type === "section_break") {
            continue;
        }
        const answer = answers[block.blockId];
        let displayValue;
        if (Array.isArray(answer)) {
            displayValue = answer.join(", ");
        } else if (answer !== undefined && answer !== null) {
            displayValue = String(answer);
        } else {
            displayValue = "(no answer)";
        }
        lines.push(`**${block.label || "Question"}**\n${displayValue}`);
    }
    let text = lines.join("\n\n");
    if (text.length > maxLength) {
        text = text.substring(0, maxLength - 50) + "\n\n*(truncated, view online for full response)*";
    }
    return text;
}
