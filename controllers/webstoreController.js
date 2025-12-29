import { createRequire } from "module";
import path from "path";
import db from "./databaseController.js";

const require = createRequire(import.meta.url);
const itemsData = require(path.join(process.cwd(), "webstoreItems.json"));

let webstoreTableCheck;

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      return resolve(results);
    });
  });
}

export function getWebstoreItems() {
  return itemsData?.items || [];
}

export function findWebstoreItem(slug) {
  const items = getWebstoreItems();
  return items.find((item) => item.slug === slug && item.isActive !== false) || null;
}

export async function ensureWebstoreTables() {
  if (!webstoreTableCheck) {
    webstoreTableCheck = new Promise((resolve) => {
      db.query(
        "CREATE TABLE IF NOT EXISTS webstorePurchases (\n" +
          "  purchaseId INT AUTO_INCREMENT PRIMARY KEY,\n" +
          "  userId INT NOT NULL,\n" +
          "  itemSlug VARCHAR(64) NOT NULL,\n" +
          "  itemName VARCHAR(120) NOT NULL,\n" +
          "  purchaseType ENUM('one_time', 'subscription') NOT NULL,\n" +
          "  minecraftUsername VARCHAR(16) NOT NULL,\n" +
          "  status ENUM('pending', 'paid', 'fulfilled', 'failed') DEFAULT 'pending',\n" +
          "  stripeSessionId VARCHAR(255) NOT NULL,\n" +
          "  stripePaymentIntentId VARCHAR(255),\n" +
          "  stripeSubscriptionId VARCHAR(255),\n" +
          "  amountCents INT NOT NULL,\n" +
          "  currency VARCHAR(10) NOT NULL,\n" +
          "  createdAt DATETIME DEFAULT NOW(),\n" +
          "  updatedAt DATETIME DEFAULT NOW(),\n" +
          "  UNIQUE KEY webstorePurchases_session (stripeSessionId),\n" +
          "  INDEX webstorePurchases_user (userId),\n" +
          "  INDEX webstorePurchases_status (status)\n" +
          ")",
        (purchaseErr) => {
          if (purchaseErr) {
            console.error("Failed to ensure webstorePurchases table", purchaseErr);
            resolve(false);
            return;
          }

          db.query(
            "CREATE TABLE IF NOT EXISTS webstoreCommandRuns (\n" +
              "  commandRunId INT AUTO_INCREMENT PRIMARY KEY,\n" +
              "  purchaseId INT NOT NULL,\n" +
              "  commandTemplate TEXT NOT NULL,\n" +
              "  resolvedCommand TEXT NOT NULL,\n" +
              "  executorTaskId INT NULL,\n" +
              "  status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',\n" +
              "  attempts INT DEFAULT 0,\n" +
              "  lastError TEXT,\n" +
              "  createdAt DATETIME DEFAULT NOW(),\n" +
              "  updatedAt DATETIME DEFAULT NOW(),\n" +
              "  INDEX webstoreCommandRuns_purchase (purchaseId),\n" +
              "  INDEX webstoreCommandRuns_executor (executorTaskId)\n" +
              ")",
            (commandErr) => {
              if (commandErr) {
                console.error("Failed to ensure webstoreCommandRuns table", commandErr);
                resolve(false);
                return;
              }

              db.query(
                "CREATE TABLE IF NOT EXISTS webstoreWebhookEvents (\n" +
                  "  webhookEventId INT AUTO_INCREMENT PRIMARY KEY,\n" +
                  "  stripeEventId VARCHAR(255) NOT NULL,\n" +
                  "  purchaseId INT NULL,\n" +
                  "  eventType VARCHAR(80) NOT NULL,\n" +
                  "  payload JSON,\n" +
                  "  createdAt DATETIME DEFAULT NOW(),\n" +
                  "  UNIQUE KEY webstoreWebhookEvents_event (stripeEventId),\n" +
                  "  INDEX webstoreWebhookEvents_purchase (purchaseId)\n" +
                  ")",
                (eventErr) => {
                  if (eventErr) {
                    console.error("Failed to ensure webstoreWebhookEvents table", eventErr);
                    resolve(false);
                    return;
                  }

                  resolve(true);
                }
              );
            }
          );
        }
      );
    });
  }

  return webstoreTableCheck;
}

export async function createPendingPurchase({
  userId,
  item,
  minecraftUsername,
  stripeSessionId,
}) {
  await ensureWebstoreTables();

  const params = [
    userId,
    item.slug,
    item.displayName,
    item.purchaseType,
    minecraftUsername,
    stripeSessionId,
    item.priceCents,
    item.currency,
  ];

  const result = await query(
    "INSERT INTO webstorePurchases (userId, itemSlug, itemName, purchaseType, minecraftUsername, stripeSessionId, amountCents, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    params
  );

  return result.insertId;
}

export async function recordWebhookEvent({ stripeEventId, purchaseId, eventType, payload }) {
  await ensureWebstoreTables();

  return query(
    "INSERT INTO webstoreWebhookEvents (stripeEventId, purchaseId, eventType, payload) VALUES (?, ?, ?, ?)",
    [stripeEventId, purchaseId || null, eventType, payload ? JSON.stringify(payload) : null]
  );
}

export async function hasWebhookEvent(stripeEventId) {
  await ensureWebstoreTables();

  const rows = await query(
    "SELECT webhookEventId FROM webstoreWebhookEvents WHERE stripeEventId = ? LIMIT 1",
    [stripeEventId]
  );

  return rows.length > 0;
}

export async function getPurchaseBySessionId(stripeSessionId) {
  await ensureWebstoreTables();

  const rows = await query(
    "SELECT * FROM webstorePurchases WHERE stripeSessionId = ? LIMIT 1",
    [stripeSessionId]
  );

  return rows[0] || null;
}

export async function updatePurchasePayment({
  purchaseId,
  status,
  paymentIntentId,
  subscriptionId,
}) {
  await ensureWebstoreTables();

  return query(
    "UPDATE webstorePurchases SET status = ?, stripePaymentIntentId = ?, stripeSubscriptionId = ?, updatedAt = NOW() WHERE purchaseId = ?",
    [status, paymentIntentId || null, subscriptionId || null, purchaseId]
  );
}

export async function insertCommandRuns(commandRuns) {
  await ensureWebstoreTables();

  if (!commandRuns.length) return 0;

  const values = commandRuns.map((run) => [
    run.purchaseId,
    run.commandTemplate,
    run.resolvedCommand,
    run.executorTaskId || null,
    run.status || "queued",
    run.attempts || 0,
    run.lastError || null,
  ]);

  const result = await query(
    "INSERT INTO webstoreCommandRuns (purchaseId, commandTemplate, resolvedCommand, executorTaskId, status, attempts, lastError) VALUES ?",
    [values]
  );

  return result.affectedRows || 0;
}

export async function updatePurchaseStatus(purchaseId, status) {
  await ensureWebstoreTables();

  return query(
    "UPDATE webstorePurchases SET status = ?, updatedAt = NOW() WHERE purchaseId = ?",
    [status, purchaseId]
  );
}

export async function updateCommandRunStatus(commandRunId, status, lastError = null) {
  await ensureWebstoreTables();

  return query(
    "UPDATE webstoreCommandRuns SET status = ?, lastError = ?, updatedAt = NOW() WHERE commandRunId = ?",
    [status, lastError, commandRunId]
  );
}

export async function incrementCommandRunAttempts(commandRunId, lastError = null) {
  await ensureWebstoreTables();

  return query(
    "UPDATE webstoreCommandRuns SET attempts = attempts + 1, lastError = ?, updatedAt = NOW() WHERE commandRunId = ?",
    [lastError, commandRunId]
  );
}

export async function getCommandRunsByPurchase(purchaseId) {
  await ensureWebstoreTables();

  return query(
    "SELECT * FROM webstoreCommandRuns WHERE purchaseId = ?",
    [purchaseId]
  );
}

export async function getCommandRunsForSync(limit = 50) {
  await ensureWebstoreTables();

  return query(
    "SELECT cr.*, et.status AS taskStatus, et.result AS taskResult FROM webstoreCommandRuns cr JOIN executorTasks et ON cr.executorTaskId = et.executorTaskId WHERE cr.status IN ('queued', 'processing', 'failed') ORDER BY cr.updatedAt ASC LIMIT ?",
    [limit]
  );
}

export async function updateCommandRunForTask(commandRunId, status, taskResult = null) {
  await ensureWebstoreTables();

  return query(
    "UPDATE webstoreCommandRuns SET status = ?, lastError = ?, updatedAt = NOW() WHERE commandRunId = ?",
    [status, taskResult || null, commandRunId]
  );
}

export async function getPurchasesNeedingFulfillment() {
  await ensureWebstoreTables();

  return query(
    "SELECT purchaseId FROM webstorePurchases WHERE status IN ('paid')",
    []
  );
}

export function formatPrice(priceCents, currency) {
  const amount = Number(priceCents) || 0;
  const normalizedCurrency = (currency || "usd").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function resolveCommandTemplate(commandTemplate, metadata) {
  let resolved = typeof commandTemplate === "string" ? commandTemplate : "";
  if (!metadata) return resolved;

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const replacement = typeof value === "string" ? value : String(value);
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    resolved = resolved.replace(pattern, replacement);
  });

  return resolved;
}
