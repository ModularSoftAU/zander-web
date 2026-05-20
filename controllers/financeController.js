/**
 * controllers/financeController.js
 *
 * All database operations for the Finance Management module.
 * Uses Prisma for typed model queries and the mysql2 pool for raw aggregates.
 */

import { prisma } from "./databaseController.js";
import db from "./databaseController.js";
import fetch from "node-fetch";

// ---------------------------------------------------------------------------
// Internal helper: wrap mysql2 pool query in a Promise
// ---------------------------------------------------------------------------

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

// =============================================================================
// Accounts
// =============================================================================

export async function getAccounts() {
  return prisma.financeAccounts.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getAccountById(id) {
  return prisma.financeAccounts.findUnique({ where: { accountId: id } });
}

export async function createAccount({ name, accountType, openingBalanceCents, currency, notes }) {
  if (!name || !name.trim()) throw new Error("Account name is required.");
  return prisma.financeAccounts.create({
    data: {
      name: name.trim(),
      accountType: accountType || "bank",
      openingBalanceCents: openingBalanceCents ? parseInt(openingBalanceCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      notes: notes?.trim() || null,
    },
  });
}

export async function updateAccount(id, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.accountType !== undefined) update.accountType = data.accountType;
  if (data.openingBalanceCents !== undefined) update.openingBalanceCents = parseInt(data.openingBalanceCents, 10);
  if (data.currency !== undefined) update.currency = data.currency.toUpperCase().trim();
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.isActive !== undefined) update.isActive = data.isActive ? 1 : 0;
  return prisma.financeAccounts.update({ where: { accountId: id }, data: update });
}

export async function deleteAccount(id) {
  return prisma.financeAccounts.delete({ where: { accountId: id } });
}

/**
 * Compute the running balance for an account:
 *   openingBalanceCents
 *   + SUM(income transactions)
 *   - SUM(expense transactions)
 *   + SUM(incoming transfers where accountId = toAccountId)
 *   - SUM(outgoing transfers where accountId = accountId)
 */
export async function computeAccountBalance(accountId) {
  const rows = await queryDb(
    `SELECT
       a.openingBalanceCents,
       COALESCE(SUM(CASE WHEN t.type = 'income'   AND t.accountId   = ? THEN t.amountCents ELSE 0 END), 0) AS incomeCents,
       COALESCE(SUM(CASE WHEN t.type = 'expense'  AND t.accountId   = ? THEN t.amountCents ELSE 0 END), 0) AS expenseCents,
       COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.toAccountId = ? THEN t.amountCents ELSE 0 END), 0) AS transfersIn,
       COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.accountId   = ? THEN t.amountCents ELSE 0 END), 0) AS transfersOut
     FROM financeAccounts a
     LEFT JOIN financeTransactions t ON (t.accountId = a.accountId OR t.toAccountId = a.accountId)
     WHERE a.accountId = ?
     GROUP BY a.accountId, a.openingBalanceCents`,
    [accountId, accountId, accountId, accountId, accountId]
  );
  if (!rows.length) return 0;
  const r = rows[0];
  return (
    (r.openingBalanceCents || 0) +
    (r.incomeCents || 0) -
    (r.expenseCents || 0) +
    (r.transfersIn || 0) -
    (r.transfersOut || 0)
  );
}

// =============================================================================
// Categories
// =============================================================================

export async function getCategories() {
  return prisma.financeCategories.findMany({
    include: { parent: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryById(id) {
  return prisma.financeCategories.findUnique({
    where: { categoryId: id },
    include: { parent: true, children: true },
  });
}

export async function createCategory({ parentId, name, type, color }) {
  if (!name || !name.trim()) throw new Error("Category name is required.");
  return prisma.financeCategories.create({
    data: {
      parentId: parentId ? parseInt(parentId, 10) : null,
      name: name.trim(),
      type: type || "expense",
      color: color || "#6c757d",
    },
  });
}

export async function updateCategory(id, data) {
  const update = {};
  if (data.parentId !== undefined) update.parentId = data.parentId ? parseInt(data.parentId, 10) : null;
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.type !== undefined) update.type = data.type;
  if (data.color !== undefined) update.color = data.color;
  if (data.isActive !== undefined) update.isActive = data.isActive ? 1 : 0;
  return prisma.financeCategories.update({ where: { categoryId: id }, data: update });
}

export async function deleteCategory(id) {
  return prisma.financeCategories.delete({ where: { categoryId: id } });
}

// =============================================================================
// Tags
// =============================================================================

export async function getTags() {
  return prisma.financeTags.findMany({ orderBy: { name: "asc" } });
}

export async function createTag({ name, color }) {
  if (!name || !name.trim()) throw new Error("Tag name is required.");
  return prisma.financeTags.create({
    data: {
      name: name.trim(),
      color: color || "#0d6efd",
    },
  });
}

export async function deleteTag(id) {
  return prisma.financeTags.delete({ where: { tagId: id } });
}

// =============================================================================
// Vendors
// =============================================================================

export async function getVendors({ activeOnly = false } = {}) {
  return prisma.financeVendors.findMany({
    where: activeOnly ? { isActive: 1 } : undefined,
    include: { category: true },
    orderBy: { name: "asc" },
  });
}

export async function getVendorById(id) {
  return prisma.financeVendors.findUnique({
    where: { vendorId: id },
    include: { category: true },
  });
}

export async function createVendor({ name, website, contactEmail, notes, categoryId, faviconUrl, logoUrl, logoPublicId }) {
  if (!name || !name.trim()) throw new Error("Vendor name is required.");
  return prisma.financeVendors.create({
    data: {
      name: name.trim(),
      website: website?.trim() || null,
      contactEmail: contactEmail?.trim() || null,
      notes: notes?.trim() || null,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      faviconUrl: faviconUrl?.trim() || null,
      logoUrl: logoUrl?.trim() || null,
      logoPublicId: logoPublicId?.trim() || null,
    },
  });
}

export async function updateVendor(id, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.website !== undefined) update.website = data.website?.trim() || null;
  if (data.contactEmail !== undefined) update.contactEmail = data.contactEmail?.trim() || null;
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.categoryId !== undefined) update.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : null;
  if (data.faviconUrl !== undefined) update.faviconUrl = data.faviconUrl?.trim() || null;
  if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl?.trim() || null;
  if (data.logoPublicId !== undefined) update.logoPublicId = data.logoPublicId?.trim() || null;
  if (data.isActive !== undefined) update.isActive = data.isActive ? 1 : 0;
  if (data.faviconFetchedAt !== undefined) update.faviconFetchedAt = data.faviconFetchedAt;
  return prisma.financeVendors.update({ where: { vendorId: id }, data: update });
}

export async function deleteVendor(id) {
  return prisma.financeVendors.delete({ where: { vendorId: id } });
}

export async function getVendorStats(vendorId) {
  const [spendRows, invoiceRows] = await Promise.all([
    queryDb(
      `SELECT COALESCE(SUM(amountCents), 0) AS totalSpentCents
         FROM financeTransactions
        WHERE vendorId = ? AND type = 'expense'`,
      [vendorId]
    ),
    queryDb(
      `SELECT
         COUNT(CASE WHEN status NOT IN ('paid','cancelled') THEN 1 END)          AS unpaidInvoicesCount,
         COUNT(CASE WHEN status = 'overdue'                 THEN 1 END)          AS overdueInvoicesCount,
         COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN (amountCents - paidAmountCents) ELSE 0 END), 0) AS unpaidAmountCents
       FROM financeInvoices
       WHERE vendorId = ?`,
      [vendorId]
    ),
  ]);
  return {
    totalSpentCents: spendRows[0]?.totalSpentCents || 0,
    unpaidInvoicesCount: invoiceRows[0]?.unpaidInvoicesCount || 0,
    overdueInvoicesCount: invoiceRows[0]?.overdueInvoicesCount || 0,
    unpaidAmountCents: invoiceRows[0]?.unpaidAmountCents || 0,
  };
}

/**
 * Fetch the vendor's favicon from Google's favicon service and cache the URL.
 * Returns the favicon URL string on success, or null on failure.
 */
export async function fetchAndCacheVendorFavicon(vendorId) {
  try {
    const vendor = await getVendorById(vendorId);
    if (!vendor || !vendor.website) return null;

    let hostname;
    try {
      hostname = new URL(vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`).hostname;
    } catch {
      return null;
    }

    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

    // Verify the URL resolves (don't store broken links)
    const response = await fetch(faviconUrl, { method: "HEAD", timeout: 5000 });
    if (!response.ok) return null;

    await prisma.financeVendors.update({
      where: { vendorId },
      data: { faviconUrl, faviconFetchedAt: new Date() },
    });

    return faviconUrl;
  } catch (error) {
    console.error(`[finance] fetchAndCacheVendorFavicon(${vendorId}):`, error.message);
    return null;
  }
}

// =============================================================================
// Transactions
// =============================================================================

function buildTransactionWhere({ type, accountId, categoryId, vendorId, dateFrom, dateTo, isLocked } = {}) {
  const where = {};
  if (type) where.type = type;
  if (accountId) where.accountId = parseInt(accountId, 10);
  if (categoryId) where.categoryId = parseInt(categoryId, 10);
  if (vendorId) where.vendorId = parseInt(vendorId, 10);
  if (isLocked !== undefined && isLocked !== null && isLocked !== "") {
    where.isLocked = isLocked ? 1 : 0;
  }
  if (dateFrom || dateTo) {
    where.transactionDate = {};
    if (dateFrom) where.transactionDate.gte = new Date(dateFrom);
    if (dateTo) where.transactionDate.lte = new Date(dateTo);
  }
  return where;
}

export async function getTransactions({
  type, accountId, categoryId, vendorId, dateFrom, dateTo, isLocked,
  limit = 50, offset = 0,
} = {}) {
  const where = buildTransactionWhere({ type, accountId, categoryId, vendorId, dateFrom, dateTo, isLocked });
  return prisma.financeTransactions.findMany({
    where,
    include: {
      account: { select: { accountId: true, name: true } },
      toAccount: { select: { accountId: true, name: true } },
      category: { select: { categoryId: true, name: true, color: true } },
      vendor: { select: { vendorId: true, name: true, faviconUrl: true } },
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
  });
}

export async function getTransactionCount({ type, accountId, categoryId, vendorId, dateFrom, dateTo, isLocked } = {}) {
  const where = buildTransactionWhere({ type, accountId, categoryId, vendorId, dateFrom, dateTo, isLocked });
  return prisma.financeTransactions.count({ where });
}

export async function getTransactionById(id) {
  return prisma.financeTransactions.findUnique({
    where: { transactionId: id },
    include: {
      account: true,
      toAccount: true,
      category: true,
      vendor: true,
      tags: { include: { tag: true } },
      attachments: true,
    },
  });
}

export async function createTransaction({
  type, amountCents, currency, accountId, toAccountId,
  categoryId, vendorId, description, notes,
  transactionDate, tagIds, createdByUserId,
}) {
  if (!type) throw new Error("Transaction type is required.");
  if (!accountId) throw new Error("Account is required.");
  if (!transactionDate) throw new Error("Transaction date is required.");

  const transaction = await prisma.financeTransactions.create({
    data: {
      type,
      amountCents: amountCents ? parseInt(amountCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      accountId: parseInt(accountId, 10),
      toAccountId: toAccountId ? parseInt(toAccountId, 10) : null,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      vendorId: vendorId ? parseInt(vendorId, 10) : null,
      description: description?.trim() || "",
      notes: notes?.trim() || null,
      transactionDate: new Date(transactionDate),
      createdByUserId: parseInt(createdByUserId, 10),
    },
  });

  // Attach tags if provided
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    await prisma.financeTransactionTags.createMany({
      data: tagIds.map((tagId) => ({ transactionId: transaction.transactionId, tagId: parseInt(tagId, 10) })),
      skipDuplicates: true,
    });
  }

  return transaction;
}

export async function updateTransaction(id, data) {
  const existing = await prisma.financeTransactions.findUnique({ where: { transactionId: id } });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.isLocked) throw new Error("locked");

  const update = {};
  if (data.type !== undefined) update.type = data.type;
  if (data.amountCents !== undefined) update.amountCents = parseInt(data.amountCents, 10);
  if (data.currency !== undefined) update.currency = data.currency.toUpperCase().trim();
  if (data.accountId !== undefined) update.accountId = parseInt(data.accountId, 10);
  if (data.toAccountId !== undefined) update.toAccountId = data.toAccountId ? parseInt(data.toAccountId, 10) : null;
  if (data.categoryId !== undefined) update.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : null;
  if (data.vendorId !== undefined) update.vendorId = data.vendorId ? parseInt(data.vendorId, 10) : null;
  if (data.description !== undefined) update.description = data.description.trim();
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.transactionDate !== undefined) update.transactionDate = new Date(data.transactionDate);

  // Handle tag replacements if provided
  if (Array.isArray(data.tagIds)) {
    await prisma.financeTransactionTags.deleteMany({ where: { transactionId: id } });
    if (data.tagIds.length > 0) {
      await prisma.financeTransactionTags.createMany({
        data: data.tagIds.map((tagId) => ({ transactionId: id, tagId: parseInt(tagId, 10) })),
        skipDuplicates: true,
      });
    }
  }

  return prisma.financeTransactions.update({ where: { transactionId: id }, data: update });
}

export async function deleteTransaction(id) {
  const existing = await prisma.financeTransactions.findUnique({ where: { transactionId: id } });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.isLocked) throw new Error("locked");
  return prisma.financeTransactions.delete({ where: { transactionId: id } });
}

export async function lockTransactionsByPeriod(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month
  return queryDb(
    `UPDATE financeTransactions SET isLocked = 1
      WHERE transactionDate >= ? AND transactionDate <= ?`,
    [startDate, endDate]
  );
}

// =============================================================================
// Invoices
// =============================================================================

function buildInvoiceWhere({ vendorId, status } = {}) {
  const where = {};
  if (vendorId) where.vendorId = parseInt(vendorId, 10);
  if (status) where.status = status;
  return where;
}

export async function getInvoices({ vendorId, status, limit = 50, offset = 0 } = {}) {
  const where = buildInvoiceWhere({ vendorId, status });
  return prisma.financeInvoices.findMany({
    where,
    include: { vendor: { select: { vendorId: true, name: true, faviconUrl: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
  });
}

export async function getInvoiceCount({ vendorId, status } = {}) {
  const where = buildInvoiceWhere({ vendorId, status });
  return prisma.financeInvoices.count({ where });
}

export async function getInvoiceById(id) {
  return prisma.financeInvoices.findUnique({
    where: { invoiceId: id },
    include: { vendor: true, payments: true, attachments: true },
  });
}

export async function createInvoice({ vendorId, invoiceNumber, issueDate, dueDate, amountCents, currency, description, createdByUserId }) {
  if (!vendorId) throw new Error("Vendor is required.");
  return prisma.financeInvoices.create({
    data: {
      vendorId: parseInt(vendorId, 10),
      invoiceNumber: invoiceNumber?.trim() || "",
      issueDate: issueDate ? new Date(issueDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      amountCents: amountCents ? parseInt(amountCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      description: description?.trim() || null,
      createdByUserId: parseInt(createdByUserId, 10) || 0,
    },
  });
}

export async function updateInvoice(id, data) {
  const update = {};
  if (data.vendorId !== undefined) update.vendorId = parseInt(data.vendorId, 10);
  if (data.invoiceNumber !== undefined) update.invoiceNumber = data.invoiceNumber.trim();
  if (data.issueDate !== undefined) update.issueDate = data.issueDate ? new Date(data.issueDate) : null;
  if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.amountCents !== undefined) update.amountCents = parseInt(data.amountCents, 10);
  if (data.currency !== undefined) update.currency = data.currency.toUpperCase().trim();
  if (data.description !== undefined) update.description = data.description?.trim() || null;
  if (data.status !== undefined) update.status = data.status;
  return prisma.financeInvoices.update({ where: { invoiceId: id }, data: update });
}

export async function deleteInvoice(id) {
  return prisma.financeInvoices.delete({ where: { invoiceId: id } });
}

export async function recalculateInvoiceStatus(invoiceId) {
  const invoice = await prisma.financeInvoices.findUnique({ where: { invoiceId } });
  if (!invoice) return;
  if (invoice.status === "cancelled") return; // don't change cancelled invoices

  const [paymentSum] = await queryDb(
    `SELECT COALESCE(SUM(amountCents), 0) AS total FROM financePayments WHERE invoiceId = ?`,
    [invoiceId]
  );
  const paidAmountCents = paymentSum?.total || 0;

  let status;
  if (paidAmountCents >= invoice.amountCents && invoice.amountCents > 0) {
    status = "paid";
  } else if (paidAmountCents > 0) {
    status = "partial";
  } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
    status = "overdue";
  } else {
    status = "pending";
  }

  return prisma.financeInvoices.update({
    where: { invoiceId },
    data: { paidAmountCents, status },
  });
}

export async function markOverdueInvoices() {
  return queryDb(
    `UPDATE financeInvoices
        SET status = 'overdue'
      WHERE status NOT IN ('paid','cancelled')
        AND dueDate IS NOT NULL
        AND dueDate < CURDATE()`
  );
}

// =============================================================================
// Payments
// =============================================================================

function buildPaymentWhere({ vendorId, invoiceId } = {}) {
  const where = {};
  if (vendorId) where.vendorId = parseInt(vendorId, 10);
  if (invoiceId) where.invoiceId = parseInt(invoiceId, 10);
  return where;
}

export async function getPayments({ vendorId, invoiceId, limit = 50, offset = 0 } = {}) {
  const where = buildPaymentWhere({ vendorId, invoiceId });
  return prisma.financePayments.findMany({
    where,
    include: {
      vendor: { select: { vendorId: true, name: true, faviconUrl: true } },
      invoice: { select: { invoiceId: true, invoiceNumber: true } },
      account: { select: { accountId: true, name: true } },
    },
    orderBy: { paidDate: "desc" },
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
  });
}

export async function getPaymentCount({ vendorId, invoiceId } = {}) {
  const where = buildPaymentWhere({ vendorId, invoiceId });
  return prisma.financePayments.count({ where });
}

export async function createPayment({
  vendorId, invoiceId, transactionId, accountId,
  amountCents, currency, paidDate, notes, createdByUserId,
}) {
  if (!vendorId) throw new Error("Vendor is required.");
  if (!accountId) throw new Error("Account is required.");
  if (!paidDate) throw new Error("Payment date is required.");

  const payment = await prisma.financePayments.create({
    data: {
      vendorId: parseInt(vendorId, 10),
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : null,
      transactionId: transactionId ? parseInt(transactionId, 10) : null,
      accountId: parseInt(accountId, 10),
      amountCents: amountCents ? parseInt(amountCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      paidDate: new Date(paidDate),
      notes: notes?.trim() || null,
      createdByUserId: parseInt(createdByUserId, 10) || 0,
    },
  });

  if (invoiceId) {
    await recalculateInvoiceStatus(parseInt(invoiceId, 10));
  }

  return payment;
}

export async function deletePayment(id) {
  const payment = await prisma.financePayments.findUnique({ where: { paymentId: id } });
  if (!payment) throw new Error("Payment not found.");
  await prisma.financePayments.delete({ where: { paymentId: id } });
  if (payment.invoiceId) {
    await recalculateInvoiceStatus(payment.invoiceId);
  }
  return payment;
}

// =============================================================================
// Attachments
// =============================================================================

export async function getAttachments({ transactionId, invoiceId, vendorId } = {}) {
  if (!transactionId && !invoiceId && !vendorId) {
    throw new Error("At least one filter (transactionId, invoiceId, or vendorId) is required.");
  }
  const where = {};
  if (transactionId) where.transactionId = parseInt(transactionId, 10);
  if (invoiceId) where.invoiceId = parseInt(invoiceId, 10);
  if (vendorId) where.vendorId = parseInt(vendorId, 10);
  return prisma.financeAttachments.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function createAttachment({
  transactionId, invoiceId, vendorId,
  fileName, fileUrl, filePublicId, mimeType, fileSizeBytes, label, uploadedByUserId,
}) {
  return prisma.financeAttachments.create({
    data: {
      transactionId: transactionId ? parseInt(transactionId, 10) : null,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : null,
      vendorId: vendorId ? parseInt(vendorId, 10) : null,
      fileName: fileName?.trim() || "",
      fileUrl: fileUrl?.trim() || "",
      filePublicId: filePublicId?.trim() || "",
      mimeType: mimeType || "application/pdf",
      fileSizeBytes: fileSizeBytes ? parseInt(fileSizeBytes, 10) : 0,
      label: label?.trim() || null,
      uploadedByUserId: parseInt(uploadedByUserId, 10) || 0,
    },
  });
}

export async function deleteAttachment(id) {
  const attachment = await prisma.financeAttachments.findUnique({ where: { attachmentId: id } });
  if (!attachment) throw new Error("Attachment not found.");
  await prisma.financeAttachments.delete({ where: { attachmentId: id } });
  return attachment;
}

// =============================================================================
// Budget
// =============================================================================

export async function getOperationsBudget() {
  return prisma.financeOperationsBudget.findMany({
    where: { isActive: 1 },
    include: {
      vendor: { select: { vendorId: true, name: true, faviconUrl: true } },
      category: { select: { categoryId: true, name: true, color: true } },
    },
    orderBy: { label: "asc" },
  });
}

export async function getAllBudgetEntries() {
  return prisma.financeOperationsBudget.findMany({
    include: {
      vendor: { select: { vendorId: true, name: true, faviconUrl: true } },
      category: { select: { categoryId: true, name: true, color: true } },
    },
    orderBy: { label: "asc" },
  });
}

export async function createBudgetEntry({ vendorId, categoryId, label, monthlyBudgetCents, currency, notes }) {
  if (!label || !label.trim()) throw new Error("Budget label is required.");
  return prisma.financeOperationsBudget.create({
    data: {
      vendorId: vendorId ? parseInt(vendorId, 10) : null,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      label: label.trim(),
      monthlyBudgetCents: monthlyBudgetCents ? parseInt(monthlyBudgetCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      notes: notes?.trim() || null,
    },
  });
}

export async function updateBudgetEntry(id, data) {
  const update = {};
  if (data.vendorId !== undefined) update.vendorId = data.vendorId ? parseInt(data.vendorId, 10) : null;
  if (data.categoryId !== undefined) update.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : null;
  if (data.label !== undefined) update.label = data.label.trim();
  if (data.monthlyBudgetCents !== undefined) update.monthlyBudgetCents = parseInt(data.monthlyBudgetCents, 10);
  if (data.currency !== undefined) update.currency = data.currency.toUpperCase().trim();
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.isActive !== undefined) update.isActive = data.isActive ? 1 : 0;
  return prisma.financeOperationsBudget.update({ where: { budgetId: id }, data: update });
}

export async function deleteBudgetEntry(id) {
  return prisma.financeOperationsBudget.delete({ where: { budgetId: id } });
}

export async function getBudgetVsActual(year, month) {
  const entries = await getOperationsBudget();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const results = await Promise.all(
    entries.map(async (entry) => {
      const conditions = [];
      const params = [];

      conditions.push("type = 'expense'");
      conditions.push("transactionDate >= ?");
      params.push(startDate);
      conditions.push("transactionDate <= ?");
      params.push(endDate);

      if (entry.vendorId) {
        conditions.push("vendorId = ?");
        params.push(entry.vendorId);
      } else if (entry.categoryId) {
        conditions.push("categoryId = ?");
        params.push(entry.categoryId);
      }

      const rows = await queryDb(
        `SELECT COALESCE(SUM(amountCents), 0) AS actualCents
           FROM financeTransactions
          WHERE ${conditions.join(" AND ")}`,
        params
      );

      const actualCents = rows[0]?.actualCents || 0;
      const varianceCents = entry.monthlyBudgetCents - actualCents;

      return { ...entry, actualCents, varianceCents };
    })
  );

  return results;
}

// =============================================================================
// Reports
// =============================================================================

export async function getMonthlyReports() {
  return prisma.financeMonthlyReports.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getMonthlyReport(year, month) {
  return prisma.financeMonthlyReports.findUnique({
    where: { year_month: { year: parseInt(year, 10), month: parseInt(month, 10) } },
  });
}

export async function generateMonthlyReportData(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const [incomeRows, expenseRows, vendorRows, categoryRows, unpaidInvoices, overdueInvoices, budgetVsActual] =
    await Promise.all([
      queryDb(
        `SELECT COALESCE(SUM(amountCents), 0) AS total
           FROM financeTransactions
          WHERE type = 'income' AND transactionDate >= ? AND transactionDate <= ?`,
        [startDate, endDate]
      ),
      queryDb(
        `SELECT COALESCE(SUM(amountCents), 0) AS total
           FROM financeTransactions
          WHERE type = 'expense' AND transactionDate >= ? AND transactionDate <= ?`,
        [startDate, endDate]
      ),
      queryDb(
        `SELECT v.vendorId, v.name, v.faviconUrl,
                COALESCE(SUM(t.amountCents), 0) AS totalCents
           FROM financeTransactions t
           JOIN financeVendors v ON v.vendorId = t.vendorId
          WHERE t.type = 'expense'
            AND t.transactionDate >= ? AND t.transactionDate <= ?
          GROUP BY v.vendorId, v.name, v.faviconUrl
          ORDER BY totalCents DESC
          LIMIT 10`,
        [startDate, endDate]
      ),
      queryDb(
        `SELECT c.categoryId, c.name, c.color,
                COALESCE(SUM(t.amountCents), 0) AS totalCents
           FROM financeTransactions t
           JOIN financeCategories c ON c.categoryId = t.categoryId
          WHERE t.type = 'expense'
            AND t.transactionDate >= ? AND t.transactionDate <= ?
          GROUP BY c.categoryId, c.name, c.color
          ORDER BY totalCents DESC`,
        [startDate, endDate]
      ),
      prisma.financeInvoices.count({
        where: { status: { in: ["pending", "partial"] } },
      }),
      prisma.financeInvoices.count({ where: { status: "overdue" } }),
      getBudgetVsActual(year, month),
    ]);

  const totalIncomeCents = incomeRows[0]?.total || 0;
  const totalExpensesCents = expenseRows[0]?.total || 0;
  const netAmountCents = totalIncomeCents - totalExpensesCents;

  return {
    totalIncomeCents,
    totalExpensesCents,
    netAmountCents,
    vendorBreakdown: vendorRows,
    categoryBreakdown: categoryRows,
    unpaidInvoices,
    overdueInvoices,
    budgetVsActual,
  };
}

export async function upsertMonthlyReport(year, month, data) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);

  return prisma.financeMonthlyReports.upsert({
    where: { year_month: { year: y, month: m } },
    create: {
      year: y,
      month: m,
      totalIncomeCents: data.totalIncomeCents || 0,
      totalExpensesCents: data.totalExpensesCents || 0,
      netAmountCents: data.netAmountCents || 0,
      reportData: data,
    },
    update: {
      totalIncomeCents: data.totalIncomeCents || 0,
      totalExpensesCents: data.totalExpensesCents || 0,
      netAmountCents: data.netAmountCents || 0,
      reportData: data,
    },
  });
}

export async function publishMonthlyReport(reportId, userId) {
  const report = await prisma.financeMonthlyReports.findUnique({ where: { reportId } });
  if (!report) throw new Error("Report not found.");

  await prisma.financeMonthlyReports.update({
    where: { reportId },
    data: {
      isPublished: 1,
      isLocked: 1,
      publishedAt: new Date(),
      publishedByUserId: parseInt(userId, 10),
    },
  });

  await lockTransactionsByPeriod(report.year, report.month);
}

// =============================================================================
// Dashboard
// =============================================================================

export async function getFinanceDashboardData() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [accounts, recentTransactions, unpaidInvoices, overdueInvoices, topVendorRows, budgetSummary] =
    await Promise.all([
      getAccounts(),
      getTransactions({ limit: 10, offset: 0 }),
      getInvoices({ status: "pending", limit: 5 }),
      getInvoices({ status: "overdue", limit: 5 }),
      queryDb(
        `SELECT v.vendorId, v.name, v.faviconUrl,
                COALESCE(SUM(t.amountCents), 0) AS totalCents
           FROM financeTransactions t
           JOIN financeVendors v ON v.vendorId = t.vendorId
          WHERE t.type = 'expense' AND t.transactionDate >= ?
          GROUP BY v.vendorId, v.name, v.faviconUrl
          ORDER BY totalCents DESC
          LIMIT 5`,
        [thirtyDaysAgo]
      ),
      getBudgetVsActual(currentYear, currentMonth),
    ]);

  // Compute balances for all accounts in parallel
  const accountsWithBalance = await Promise.all(
    accounts.map(async (account) => ({
      ...account,
      balanceCents: await computeAccountBalance(account.accountId),
    }))
  );

  return {
    accounts: accountsWithBalance,
    recentTransactions,
    unpaidInvoices,
    overdueInvoices,
    topVendors: topVendorRows,
    budgetSummary,
  };
}

// =============================================================================
// Helpers
// =============================================================================

export function centsToDisplay(cents, currency = "USD") {
  const amount = (cents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export function hasFinancePermission(req, level = "view") {
  const perms = req.session?.user?.permissions ?? [];
  if (!Array.isArray(perms) || perms.length === 0) return false;

  const node = level === "manage" ? "zander.web.finance.manage" : "zander.web.finance";

  return perms.some((p) => {
    const c = String(p || "").trim().toLowerCase();
    if (!c) return false;
    if (c === "*") return true;
    if (c === node) return true;
    if (c.endsWith(".*")) {
      const base = c.slice(0, -2);
      return node === base || node.startsWith(base + ".");
    }
    return false;
  });
}
