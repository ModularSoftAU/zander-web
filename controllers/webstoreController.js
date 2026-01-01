import db from "./databaseController.js";
import fetch from "node-fetch";

let webstoreTableCheck;

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      return resolve(results);
    });
  });
}

async function fetchStripePrices() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Stripe secret key is not configured");
  }

  const prices = [];
  let startingAfter = null;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      limit: "100",
      active: "true",
    });
    params.append("expand[]", "data.product");
    if (startingAfter) {
      params.append("starting_after", startingAfter);
    }

    const response = await fetch(`https://api.stripe.com/v1/prices?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stripe API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    prices.push(...(data.data || []));
    hasMore = Boolean(data.has_more);
    startingAfter = data.data?.length ? data.data[data.data.length - 1].id : null;
  }

  return prices;
}

function resolveStripePriceAmount(price, preferredCurrency) {
  if (!preferredCurrency) {
    return { amount: price.unit_amount || 0, currency: price.currency || "usd" };
  }

  const currencyKey = preferredCurrency.toLowerCase();
  const currencyOption = price.currency_options?.[currencyKey];
  if (currencyOption?.unit_amount) {
    return { amount: currencyOption.unit_amount, currency: currencyKey };
  }

  return { amount: price.unit_amount || 0, currency: price.currency || "usd" };
}

async function loadStripeItems(preferredCurrency = null) {
  const prices = await fetchStripePrices();

  return prices
    .filter((price) => price.active && price.product && price.product.active)
    .map((price) => {
      const resolved = resolveStripePriceAmount(price, preferredCurrency);
      return {
        slug: price.id,
        stripePriceId: price.id,
        displayName: price.product?.name || price.nickname || price.id,
        description: price.product?.description || "",
        imageUrl: price.product?.images?.[0] || null,
        priceCents: resolved.amount,
        currency: resolved.currency,
        purchaseType: price.type === "recurring" || price.recurring ? "subscription" : "one_time",
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
          "  purchaserMinecraftUsername VARCHAR(16) NOT NULL,\n" +
          "  recipientMinecraftUsername VARCHAR(16) NOT NULL,\n" +
          "  status ENUM('pending', 'paid', 'fulfilled', 'failed') DEFAULT 'pending',\n" +
          "  stripeSessionId VARCHAR(255) NOT NULL,\n" +
          "  stripePaymentIntentId VARCHAR(255),\n" +
          "  stripeSubscriptionId VARCHAR(255),\n" +
          "  amountCents INT NOT NULL,\n" +
          "  currency VARCHAR(10) NOT NULL,\n" +
          "  isGift TINYINT(1) DEFAULT 0,\n" +
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

                  db.query(
                    "CREATE TABLE IF NOT EXISTS webstoreStripeCommands (\n" +
                      "  commandId INT AUTO_INCREMENT PRIMARY KEY,\n" +
                      "  stripePriceId VARCHAR(120) NOT NULL,\n" +
                      "  commandTemplate TEXT NOT NULL,\n" +
                      "  sortOrder INT DEFAULT 0,\n" +
                      "  createdAt DATETIME DEFAULT NOW(),\n" +
                      "  INDEX webstoreStripeCommands_price (stripePriceId)\n" +
                      ")",
                    (commandsErr) => {
                      if (commandsErr) {
                        console.error("Failed to ensure webstoreStripeCommands table", commandsErr);
                        resolve(false);
                        return;
                      }

                      db.query(
                        "CREATE TABLE IF NOT EXISTS webstoreTransactions (\n" +
                          "  transactionId INT AUTO_INCREMENT PRIMARY KEY,\n" +
                          "  purchaseId INT NOT NULL,\n" +
                          "  userId INT NOT NULL,\n" +
                          "  direction ENUM('incoming', 'outgoing') NOT NULL,\n" +
                          "  counterpartyMinecraftUsername VARCHAR(16) NOT NULL,\n" +
                          "  amountCents INT NOT NULL,\n" +
                          "  currency VARCHAR(10) NOT NULL,\n" +
                          "  createdAt DATETIME DEFAULT NOW(),\n" +
                          "  INDEX webstoreTransactions_user (userId),\n" +
                          "  INDEX webstoreTransactions_purchase (purchaseId)\n" +
                          ")",
                        (transactionsErr) => {
                          if (transactionsErr) {
                            console.error(
                              "Failed to ensure webstoreTransactions table",
                              transactionsErr
                            );
                            resolve(false);
                            return;
                          }

                          db.query(
                            "CREATE TABLE IF NOT EXISTS webstoreContacts (\n" +
                              "  contactId INT AUTO_INCREMENT PRIMARY KEY,\n" +
                              "  userId INT NOT NULL,\n" +
                              "  minecraftUsername VARCHAR(16) NOT NULL,\n" +
                              "  lastTransactionAt DATETIME DEFAULT NOW(),\n" +
                              "  lastTransactionDirection ENUM('incoming', 'outgoing') NOT NULL,\n" +
                              "  UNIQUE KEY webstoreContacts_user (userId, minecraftUsername)\n" +
                              ")",
                            (contactsErr) => {
                              if (contactsErr) {
                                console.error(
                                  "Failed to ensure webstoreContacts table",
                                  contactsErr
                                );
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
  purchaserMinecraftUsername,
  recipientMinecraftUsername,
  stripeSessionId,
  isGift,
}) {
  await ensureWebstoreTables();

  const params = [
    userId,
    item.slug,
    item.displayName,
    item.purchaseType,
    purchaserMinecraftUsername,
    recipientMinecraftUsername,
    stripeSessionId,
    item.priceCents,
    item.currency,
    isGift ? 1 : 0,
  ];

  const result = await query(
    "INSERT INTO webstorePurchases (userId, itemSlug, itemName, purchaseType, purchaserMinecraftUsername, recipientMinecraftUsername, stripeSessionId, amountCents, currency, isGift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

export async function getWebstoreItems(preferredCurrency = null) {
  await ensureWebstoreTables();

  const items = await loadStripeItems(preferredCurrency);
  if (!items.length) return [];

  const priceIds = items.map((item) => item.stripePriceId);
  const commands = await query(
    `SELECT stripePriceId, commandTemplate FROM webstoreStripeCommands WHERE stripePriceId IN (${priceIds
      .map(() => "?")
      .join(",")}) ORDER BY sortOrder ASC, commandId ASC`,
    priceIds
  );

  const commandsByPrice = commands.reduce((acc, command) => {
    if (!acc[command.stripePriceId]) acc[command.stripePriceId] = [];
    acc[command.stripePriceId].push(command.commandTemplate);
    return acc;
  }, {});

  return items.map((item) => ({
    ...item,
    commandTemplates: commandsByPrice[item.stripePriceId] || [],
  }));
}

export async function findWebstoreItem(slug) {
  const items = await getWebstoreItems();
  return items.find((item) => item.slug === slug) || null;
}

export async function addWebstoreItemCommand({
  stripePriceId,
  commandTemplate,
  sortOrder,
}) {
  await ensureWebstoreTables();

  const result = await query(
    "INSERT INTO webstoreStripeCommands (stripePriceId, commandTemplate, sortOrder) VALUES (?, ?, ?)",
    [stripePriceId, commandTemplate, sortOrder || 0]
  );

  return result.insertId;
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

export async function createTransactionsForPurchase({
  purchaseId,
  payerUserId,
  payerMinecraftUsername,
  recipientMinecraftUsername,
  amountCents,
  currency,
}) {
  await ensureWebstoreTables();

  const transactions = [
    [
      purchaseId,
      payerUserId,
      "outgoing",
      recipientMinecraftUsername,
      amountCents,
      currency,
    ],
  ];

  if (payerMinecraftUsername !== recipientMinecraftUsername) {
    const recipientRows = await query(
      "SELECT userId FROM users WHERE username = ? LIMIT 1",
      [recipientMinecraftUsername]
    );
    const recipientUserId = recipientRows?.[0]?.userId;
    if (recipientUserId) {
      transactions.push([
        purchaseId,
        recipientUserId,
        "incoming",
        payerMinecraftUsername,
        amountCents,
        currency,
      ]);
    }
  }

  await query(
    "INSERT INTO webstoreTransactions (purchaseId, userId, direction, counterpartyMinecraftUsername, amountCents, currency) VALUES ?",
    [transactions]
  );

  const contactUpdates = transactions.map((transaction) => [
    transaction[1],
    transaction[3],
    transaction[2],
  ]);

  await query(
    "INSERT INTO webstoreContacts (userId, minecraftUsername, lastTransactionDirection) VALUES ? ON DUPLICATE KEY UPDATE lastTransactionAt = NOW(), lastTransactionDirection = VALUES(lastTransactionDirection)",
    [contactUpdates]
  );
}

export async function getMonthlyPurchaseTotals(startDate, endDate) {
  await ensureWebstoreTables();

  const results = await query(
    "SELECT COALESCE(SUM(amountCents), 0) AS totalCents FROM webstorePurchases WHERE status IN ('paid', 'fulfilled') AND createdAt BETWEEN ? AND ?",
    [startDate, endDate]
  );

  return Number(results?.[0]?.totalCents || 0);
}

export function formatPrice(priceCents, currency, locale = "en-US") {
  const amount = Number(priceCents) || 0;
  const normalizedCurrency = (currency || "usd").toUpperCase();
  return new Intl.NumberFormat(locale, {
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
