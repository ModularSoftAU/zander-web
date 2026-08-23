/**
 * controllers/financeController.js
 *
 * All database operations for the Finance Management module.
 * Covers: transactions (income/expense), budget, and categories.
 */

import { prisma } from "./databaseController.js";
import db from "./databaseController.js";
import { getMonthlyPurchaseTotals } from "./webstoreController.js";

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

function getMonthRange(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return { startDate, endDate };
}

const BUDGET_ICON_NAMES = new Set([
  "server", "cloud", "globe", "database", "shield-halved", "code",
  "plug", "wifi", "hard-drive", "people-group", "tools", "receipt",
]);

function normaliseBudgetIcon(iconName, iconImageUrl) {
  const selectedIcon = BUDGET_ICON_NAMES.has(iconName) ? iconName : null;
  const imageUrl = typeof iconImageUrl === "string" && /^https:\/\//i.test(iconImageUrl.trim())
    ? iconImageUrl.trim()
    : null;
  return { iconName: selectedIcon, iconImageUrl: imageUrl };
}

function normaliseBudgetLabel(label) {
  return String(label || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function normaliseReportMonth(year, month) {
  const parsedYear = parseInt(year, 10);
  const parsedMonth = parseInt(month, 10);
  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new Error("Invalid report month.");
  }
  return { year: parsedYear, month: parsedMonth };
}

function getPublicCategoryDisplay(category) {
  return {
    name: (category.publicName || category.name || "").trim(),
    description: (category.publicDescription || "").trim(),
    sortOrder: Number.isInteger(category.publicSortOrder) ? category.publicSortOrder : 0,
  };
}

function buildPublicCategoryGroups(categories, totalsByCategoryId) {
  const grouped = new Map();

  for (const category of categories) {
    const cents = Number(totalsByCategoryId.get(category.categoryId) || 0);
    const display = getPublicCategoryDisplay(category);
    const key = JSON.stringify({
      name: display.name,
      description: display.description,
      sortOrder: display.sortOrder,
    });

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: display.name,
        description: display.description,
        sortOrder: display.sortOrder,
        totalCents: 0,
        categoryIds: [],
      });
    }

    const entry = grouped.get(key);
    entry.totalCents += cents;
    entry.categoryIds.push(category.categoryId);
  }

  return Array.from(grouped.values())
    .filter((entry) => entry.totalCents > 0)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
}

// =============================================================================
// Accounts (minimal — used by automated webstore income recording)
// =============================================================================

/** Returns the first Stripe account, falling back to any account. Used by automated income recording. */
export async function getDefaultWebstoreAccount() {
  return (
    (await prisma.financeAccounts.findFirst({ where: { accountType: "stripe" }, orderBy: { accountId: "asc" } })) ??
    (await prisma.financeAccounts.findFirst({ orderBy: { accountId: "asc" } }))
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
  if (data.isPublic !== undefined) update.isPublic = data.isPublic ? 1 : 0;
  if (data.publicName !== undefined) update.publicName = data.publicName?.trim() || null;
  if (data.publicDescription !== undefined) update.publicDescription = data.publicDescription?.trim() || null;
  if (data.publicSortOrder !== undefined) update.publicSortOrder = parseInt(data.publicSortOrder, 10) || 0;
  return prisma.financeCategories.update({ where: { categoryId: id }, data: update });
}

export async function deleteCategory(id) {
  return prisma.financeCategories.delete({ where: { categoryId: id } });
}

// =============================================================================
// Transactions
// =============================================================================

function buildTransactionWhere({ type, categoryId, dateFrom, dateTo } = {}) {
  const where = {};
  if (type) where.type = type;
  if (categoryId) where.categoryId = parseInt(categoryId, 10);
  if (dateFrom || dateTo) {
    where.transactionDate = {};
    if (dateFrom) where.transactionDate.gte = new Date(dateFrom);
    if (dateTo) where.transactionDate.lte = new Date(dateTo);
  }
  return where;
}

export async function getTransactions({
  type, categoryId, dateFrom, dateTo,
  limit = 50, offset = 0,
} = {}) {
  const where = buildTransactionWhere({ type, categoryId, dateFrom, dateTo });
  return prisma.financeTransactions.findMany({
    where,
    include: {
      category: { select: { categoryId: true, name: true, color: true } },
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
  });
}

export async function getTransactionCount({ type, categoryId, dateFrom, dateTo } = {}) {
  const where = buildTransactionWhere({ type, categoryId, dateFrom, dateTo });
  return prisma.financeTransactions.count({ where });
}

export async function getTransactionById(id) {
  return prisma.financeTransactions.findUnique({
    where: { transactionId: id },
    include: {
      category: true,
    },
  });
}

export async function createTransaction({
  type, amountCents, currency,
  accountId, categoryId, description, notes,
  transactionDate, createdByUserId,
}) {
  if (!type) throw new Error("Transaction type is required.");
  if (!transactionDate) throw new Error("Transaction date is required.");

  return prisma.financeTransactions.create({
    data: {
      type,
      amountCents: amountCents ? parseInt(amountCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      accountId: accountId ? parseInt(accountId, 10) : null,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      description: description?.trim() || "",
      notes: notes?.trim() || null,
      transactionDate: new Date(transactionDate),
      createdByUserId: parseInt(createdByUserId, 10) || 0,
    },
  });
}

export async function updateTransaction(id, data) {
  const existing = await prisma.financeTransactions.findUnique({ where: { transactionId: id } });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.isLocked) throw new Error("locked");

  const update = {};
  if (data.type !== undefined) update.type = data.type;
  if (data.amountCents !== undefined) update.amountCents = parseInt(data.amountCents, 10);
  if (data.currency !== undefined) update.currency = data.currency.toUpperCase().trim();
  if (data.categoryId !== undefined) update.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : null;
  if (data.description !== undefined) update.description = data.description.trim();
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.transactionDate !== undefined) update.transactionDate = new Date(data.transactionDate);

  return prisma.financeTransactions.update({ where: { transactionId: id }, data: update });
}

export async function deleteTransaction(id) {
  const existing = await prisma.financeTransactions.findUnique({ where: { transactionId: id } });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.isLocked) throw new Error("locked");
  return prisma.financeTransactions.delete({ where: { transactionId: id } });
}

// =============================================================================
// Budget
// =============================================================================

export async function getOperationsBudget() {
  return prisma.financeOperationsBudget.findMany({
    where: { isActive: 1 },
    include: {
      category: { select: { categoryId: true, name: true, color: true } },
    },
    orderBy: { label: "asc" },
  });
}

export async function getAllBudgetEntries() {
  return prisma.financeOperationsBudget.findMany({
    include: {
      category: { select: { categoryId: true, name: true, color: true } },
    },
    orderBy: { label: "asc" },
  });
}

export async function createBudgetEntry({ categoryId, label, monthlyBudgetCents, currency, cadence, annualMonth, iconName, iconImageUrl, notes }) {
  const normalisedLabel = normaliseBudgetLabel(label);
  if (!normalisedLabel) throw new Error("Budget label is required.");
  const normalisedCadence = cadence === "annual" ? "annual" : "monthly";
  const normalisedAnnualMonth = normalisedCadence === "annual" ? parseInt(annualMonth, 10) : null;
  if (normalisedCadence === "annual" && (!Number.isInteger(normalisedAnnualMonth) || normalisedAnnualMonth < 1 || normalisedAnnualMonth > 12)) {
    throw new Error("A renewal month is required for annual budget items.");
  }
  const icon = normaliseBudgetIcon(iconName, iconImageUrl);
  return prisma.financeOperationsBudget.create({
    data: {
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      label: normalisedLabel,
      monthlyBudgetCents: monthlyBudgetCents ? parseInt(monthlyBudgetCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      cadence: normalisedCadence,
      annualMonth: normalisedAnnualMonth,
      ...icon,
      notes: notes?.trim() || null,
    },
  });
}

export async function updateBudgetEntry(id, data) {
  const update = {};
  if (data.categoryId !== undefined) update.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : null;
  if (data.label !== undefined) update.label = normaliseBudgetLabel(data.label);
  if (data.monthlyBudgetCents !== undefined) update.monthlyBudgetCents = parseInt(data.monthlyBudgetCents, 10);
  if (data.currency !== undefined) update.currency = data.currency.toUpperCase().trim();
  if (data.cadence !== undefined) {
    update.cadence = data.cadence === "annual" ? "annual" : "monthly";
    update.annualMonth = update.cadence === "annual" ? parseInt(data.annualMonth, 10) : null;
    if (update.cadence === "annual" && (!Number.isInteger(update.annualMonth) || update.annualMonth < 1 || update.annualMonth > 12)) {
      throw new Error("A renewal month is required for annual budget items.");
    }
  }
  if (data.iconName !== undefined || data.iconImageUrl !== undefined) {
    Object.assign(update, normaliseBudgetIcon(data.iconName, data.iconImageUrl));
  }
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.isActive !== undefined) update.isActive = data.isActive ? 1 : 0;
  return prisma.financeOperationsBudget.update({ where: { budgetId: id }, data: update });
}

export async function deleteBudgetEntry(id) {
  return prisma.financeOperationsBudget.delete({ where: { budgetId: id } });
}

// =============================================================================
// Budget — per-month overrides / one-off items
// =============================================================================
// financeOperationsBudget is the standing template and never changes month to
// month. financeOperationsBudgetMonthly holds this specific month's
// deviations from it: an override (budgetItemId set) or a one-off item
// (budgetItemId null). A month with no rows here just uses the template as-is.

export async function getMonthlyBudgetRows(year, month) {
  return prisma.financeOperationsBudgetMonthly.findMany({
    where: { year: Number(year), month: Number(month) },
    include: {
      category: { select: { categoryId: true, name: true, color: true } },
    },
  });
}

export async function upsertMonthlyBudgetOverride({ year, month, budgetItemId, monthlyBudgetCents }) {
  const template = await prisma.financeOperationsBudget.findUnique({ where: { budgetId: Number(budgetItemId) } });
  if (!template) throw new Error("Template budget item not found.");

  return prisma.financeOperationsBudgetMonthly.upsert({
    where: {
      year_month_budgetItemId: { year: Number(year), month: Number(month), budgetItemId: Number(budgetItemId) },
    },
    create: {
      year: Number(year),
      month: Number(month),
      budgetItemId: Number(budgetItemId),
      categoryId: template.categoryId,
      label: template.label,
      monthlyBudgetCents: parseInt(monthlyBudgetCents, 10) || 0,
      currency: template.currency,
      iconName: template.iconName,
      iconImageUrl: template.iconImageUrl,
    },
    update: {
      monthlyBudgetCents: parseInt(monthlyBudgetCents, 10) || 0,
    },
  });
}

export async function resetMonthlyBudgetOverride(year, month, budgetItemId) {
  return prisma.financeOperationsBudgetMonthly.deleteMany({
    where: { year: Number(year), month: Number(month), budgetItemId: Number(budgetItemId) },
  });
}

export async function createOneOffBudgetItem({ year, month, categoryId, label, monthlyBudgetCents, currency, iconName, iconImageUrl, notes }) {
  const normalisedLabel = normaliseBudgetLabel(label);
  if (!normalisedLabel) throw new Error("Budget label is required.");
  const icon = normaliseBudgetIcon(iconName, iconImageUrl);
  return prisma.financeOperationsBudgetMonthly.create({
    data: {
      year: Number(year),
      month: Number(month),
      budgetItemId: null,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      label: normalisedLabel,
      monthlyBudgetCents: monthlyBudgetCents ? parseInt(monthlyBudgetCents, 10) : 0,
      currency: (currency || "USD").toUpperCase().trim(),
      ...icon,
      notes: notes?.trim() || null,
    },
  });
}

export async function deleteMonthlyBudgetItem(monthlyBudgetItemId) {
  return prisma.financeOperationsBudgetMonthly.delete({ where: { monthlyBudgetItemId: Number(monthlyBudgetItemId) } });
}

async function computeActualCents(categoryId, startDate, endDate) {
  const conditions = ["type = 'expense'", "transactionDate >= ?", "transactionDate <= ?"];
  const params = [startDate, endDate];
  if (categoryId) {
    conditions.push("categoryId = ?");
    params.push(categoryId);
  }
  const rows = await queryDb(
    `SELECT COALESCE(SUM(amountCents), 0) AS actualCents
       FROM financeTransactions
      WHERE ${conditions.join(" AND ")}`,
    params
  );
  return rows[0]?.actualCents || 0;
}

export async function getBudgetVsActual(year, month) {
  const [templateEntries, monthlyRows] = await Promise.all([
    getOperationsBudget(),
    getMonthlyBudgetRows(year, month),
  ]);

  const overrideByBudgetItemId = new Map();
  const oneOffRows = [];
  for (const row of monthlyRows) {
    if (row.budgetItemId) overrideByBudgetItemId.set(row.budgetItemId, row);
    else oneOffRows.push(row);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const templateResults = await Promise.all(
    templateEntries.map(async (entry) => {
      const override = overrideByBudgetItemId.get(entry.budgetId) || null;
      const appliesThisMonth = entry.cadence !== "annual" || entry.annualMonth === Number(month);
      const monthlyBudgetCents = override
        ? override.monthlyBudgetCents
        : (appliesThisMonth ? entry.monthlyBudgetCents : 0);
      const actualCents = await computeActualCents(entry.categoryId, startDate, endDate);

      return {
        ...entry,
        label: normaliseBudgetLabel(entry.label),
        monthlyBudgetCents,
        templateMonthlyBudgetCents: entry.monthlyBudgetCents,
        isOverridden: Boolean(override),
        monthlyBudgetItemId: override?.monthlyBudgetItemId || null,
        isOneOff: false,
        actualCents,
        varianceCents: monthlyBudgetCents - actualCents,
      };
    })
  );

  const oneOffResults = await Promise.all(
    oneOffRows.map(async (row) => {
      const actualCents = await computeActualCents(row.categoryId, startDate, endDate);
      return {
        budgetId: null,
        monthlyBudgetItemId: row.monthlyBudgetItemId,
        categoryId: row.categoryId,
        category: row.category,
        label: normaliseBudgetLabel(row.label),
        monthlyBudgetCents: row.monthlyBudgetCents,
        templateMonthlyBudgetCents: null,
        currency: row.currency,
        iconName: row.iconName,
        iconImageUrl: row.iconImageUrl,
        notes: row.notes,
        isOverridden: false,
        isOneOff: true,
        actualCents,
        varianceCents: row.monthlyBudgetCents - actualCents,
      };
    })
  );

  return [...templateResults, ...oneOffResults];
}

// =============================================================================
// Public Finance Centre / Reports
// =============================================================================

export function getFinanceMonthlyGoalCents(config) {
  return (
    Number(config?.siteConfiguration?.webstore?.monthlyGoalCents) ||
    Number(process.env.WEBSTORE_MONTHLY_GOAL_CENTS) ||
    10000
  );
}

export async function getPublicExpenseCategories() {
  return prisma.financeCategories.findMany({
    where: {
      type: "expense",
      isActive: 1,
      isPublic: 1,
    },
    orderBy: [
      { publicSortOrder: "asc" },
      { publicName: "asc" },
      { name: "asc" },
    ],
  });
}

export async function getPublicExpenseCategoryBreakdown(year, month) {
  const { startDate, endDate } = getMonthRange(year, month);
  const categories = await getPublicExpenseCategories();

  if (!categories.length) {
    return {
      categories: [],
      totalOperatingCostsCents: 0,
      includedCategoryIds: [],
      includedCategoryNames: [],
    };
  }

  const categoryIds = categories.map((category) => category.categoryId);
  const rows = await prisma.financeTransactions.groupBy({
    by: ["categoryId"],
    where: {
      type: "expense",
      categoryId: { in: categoryIds },
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amountCents: true,
    },
  });

  const totalsByCategoryId = new Map(
    rows.map((row) => [row.categoryId, Number(row._sum.amountCents || 0)])
  );

  const groupedCategories = buildPublicCategoryGroups(categories, totalsByCategoryId);
  const totalOperatingCostsCents = groupedCategories.reduce((sum, category) => sum + category.totalCents, 0);

  return {
    categories: groupedCategories,
    totalOperatingCostsCents,
    includedCategoryIds: categoryIds,
    includedCategoryNames: categories.map((category) => category.name),
  };
}

export async function getPublicOperationsBudgetBreakdown(year, month) {
  const budgetRows = await getBudgetVsActual(year, month);
  const grouped = new Map();

  for (const row of budgetRows) {
    const totalCents = Number(row.monthlyBudgetCents || 0);
    if (totalCents <= 0) continue;

    const name = (row.label || row.category?.name || "Operating cost").trim();
    const currency = (row.currency || "USD").toUpperCase();
    const key = JSON.stringify({ name, currency });
    const current = grouped.get(key) || {
      key,
      name,
      description: "",
      totalCents: 0,
      currency,
      iconName: row.iconName || null,
      iconImageUrl: row.iconImageUrl || null,
    };

    current.totalCents += totalCents;
    grouped.set(key, current);
  }

  const categories = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  const currencies = new Set(categories.map((category) => category.currency));
  return {
    categories,
    totalOperatingCostsCents: categories.reduce((sum, category) => sum + category.totalCents, 0),
    currency: currencies.size === 1 ? categories[0].currency : "USD",
  };
}

export async function buildPublicFinanceSnapshot({
  year,
  month,
  monthlyGoalCents,
  publicNote = null,
}) {
  const { startDate, endDate } = getMonthRange(year, month);
  const [communitySupportCents, budgetBreakdown] = await Promise.all([
    getMonthlyPurchaseTotals(startDate, endDate),
    getPublicOperationsBudgetBreakdown(year, month),
  ]);

  const fundingProgressPercent = monthlyGoalCents > 0
    ? Math.round((communitySupportCents / monthlyGoalCents) * 100)
    : 0;

  const remainingFundedByCfcCents = Math.max(budgetBreakdown.totalOperatingCostsCents - communitySupportCents, 0);
  const aboveOperatingCostsCents = Math.max(communitySupportCents - budgetBreakdown.totalOperatingCostsCents, 0);
  const netPositionCents = communitySupportCents - budgetBreakdown.totalOperatingCostsCents;

  return {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    monthLabel: new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    fundingGoalCents: monthlyGoalCents,
    communitySupportCents,
    fundingProgressPercent,
    operatingCostsCents: budgetBreakdown.totalOperatingCostsCents,
    operatingCostsCurrency: budgetBreakdown.currency,
    remainingFundedByCfcCents,
    aboveOperatingCostsCents,
    netPositionCents,
    categories: budgetBreakdown.categories,
    publicNote: publicNote?.trim() || null,
    includedCategoryIds: [],
    includedCategoryNames: budgetBreakdown.categories.map((category) => category.name),
  };
}

export async function getPublishedFinanceReports(limit = 12) {
  const reports = await prisma.financeMonthlyReports.findMany({
    where: { isPublished: 1 },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: limit,
  });

  return reports.map((report) => {
    const snapshot = report.reportData && typeof report.reportData === "object"
      ? report.reportData
      : null;

    return {
      ...report,
      snapshot: snapshot || {
        year: report.year,
        month: report.month,
        monthLabel: new Date(report.year, report.month - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        communitySupportCents: report.totalIncomeCents || 0,
        operatingCostsCents: report.totalExpensesCents || 0,
        netPositionCents: report.netAmountCents || 0,
        publicNote: report.notes || null,
        categories: [],
        fundingGoalCents: 0,
        fundingProgressPercent: 0,
      },
    };
  });
}

export async function getFinanceReportRecord(year, month) {
  const normalised = normaliseReportMonth(year, month);
  return prisma.financeMonthlyReports.findUnique({
    where: {
      year_month: {
        year: normalised.year,
        month: normalised.month,
      },
    },
  });
}

export async function getPublishedFinanceReportByMonth(year, month) {
  const report = await getFinanceReportRecord(year, month);
  if (!report || report.isPublished !== 1) return null;

  const snapshot = report.reportData && typeof report.reportData === "object"
    ? report.reportData
    : null;

  return {
    ...report,
    snapshot: snapshot || {
      year: report.year,
      month: report.month,
      monthLabel: new Date(report.year, report.month - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      communitySupportCents: report.totalIncomeCents || 0,
      operatingCostsCents: report.totalExpensesCents || 0,
      netPositionCents: report.netAmountCents || 0,
      publicNote: report.notes || null,
      categories: [],
      fundingGoalCents: 0,
      fundingProgressPercent: 0,
    },
  };
}

export async function publishFinanceMonthlyReport({
  year,
  month,
  monthlyGoalCents,
  publicNote,
  publishedByUserId,
}) {
  const normalised = normaliseReportMonth(year, month);
  const existing = await getFinanceReportRecord(normalised.year, normalised.month);

  if (existing?.isLocked) {
    throw new Error("This report is locked and cannot be updated.");
  }

  const snapshot = await buildPublicFinanceSnapshot({
    year: normalised.year,
    month: normalised.month,
    monthlyGoalCents,
    publicNote,
  });

  return prisma.financeMonthlyReports.upsert({
    where: {
      year_month: {
        year: normalised.year,
        month: normalised.month,
      },
    },
    update: {
      totalIncomeCents: snapshot.communitySupportCents,
      totalExpensesCents: snapshot.operatingCostsCents,
      netAmountCents: snapshot.netPositionCents,
      notes: snapshot.publicNote,
      reportData: snapshot,
      isPublished: 1,
      publishedAt: new Date(),
      publishedByUserId: parseInt(publishedByUserId, 10) || null,
    },
    create: {
      year: normalised.year,
      month: normalised.month,
      totalIncomeCents: snapshot.communitySupportCents,
      totalExpensesCents: snapshot.operatingCostsCents,
      netAmountCents: snapshot.netPositionCents,
      notes: snapshot.publicNote,
      reportData: snapshot,
      isPublished: 1,
      isLocked: 0,
      publishedAt: new Date(),
      publishedByUserId: parseInt(publishedByUserId, 10) || null,
    },
  });
}

export async function lockFinanceMonthlyReport(year, month) {
  const normalised = normaliseReportMonth(year, month);
  const report = await getFinanceReportRecord(normalised.year, normalised.month);
  if (!report) throw new Error("Report not found.");

  return prisma.financeMonthlyReports.update({
    where: { reportId: report.reportId },
    data: { isLocked: 1 },
  });
}

// =============================================================================
// Dashboard
// =============================================================================

export async function getFinanceDashboardData() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const startOfNextMonth = new Date(currentYear, currentMonth, 1);

  const [incomeRows, expenseRows, webstoreIncomeCents, financeTransactions, recentPurchases, budgetSummary] = await Promise.all([
    queryDb(
      `SELECT COALESCE(SUM(amountCents), 0) AS total
         FROM financeTransactions
        WHERE type = 'income' AND transactionDate >= ? AND transactionDate < ?`,
      [startOfMonth, startOfNextMonth]
    ),
    queryDb(
      `SELECT COALESCE(SUM(amountCents), 0) AS total
         FROM financeTransactions
        WHERE type = 'expense' AND transactionDate >= ? AND transactionDate < ?`,
      [startOfMonth, startOfNextMonth]
    ),
    getMonthlyPurchaseTotals(startOfMonth, startOfNextMonth),
    getTransactions({ limit: 10, offset: 0 }),
    queryDb(
      `SELECT purchaseId, itemName, purchaseType, amountCents, currency, createdAt,
              purchaserMinecraftUsername, recipientMinecraftUsername, isGift
         FROM webstorePurchases
        WHERE status IN ('paid', 'fulfilled')
          AND createdAt >= ? AND createdAt < ?
        ORDER BY createdAt DESC
        LIMIT 10`,
      [startOfMonth, startOfNextMonth]
    ),
    getBudgetVsActual(currentYear, currentMonth),
  ]);

  const financeIncomeCents = Number(incomeRows[0]?.total || 0);
  const totalIncomeCents = financeIncomeCents + Number(webstoreIncomeCents || 0);
  const totalExpensesCents = expenseRows[0]?.total || 0;
  const netAmountCents = totalIncomeCents - totalExpensesCents;
  const recentTransactions = [
    ...(financeTransactions || []).map((tx) => ({
      ...tx,
      activityDate: tx.transactionDate || tx.createdAt,
    })),
    ...(recentPurchases || []).map((purchase) => ({
      transactionId: `webstore-${purchase.purchaseId}`,
      type: "income",
      amountCents: purchase.amountCents,
      currency: purchase.currency,
      description: purchase.itemName || "Webstore purchase",
      notes: purchase.isGift
        ? `Gift purchase for ${purchase.recipientMinecraftUsername}`
        : `Purchased by ${purchase.purchaserMinecraftUsername}`,
      transactionDate: purchase.createdAt,
      createdAt: purchase.createdAt,
      category: { categoryId: null, name: "Stripe / Webstore", color: "#198754" },
      activityDate: purchase.createdAt,
      source: "webstore",
      purchaseType: purchase.purchaseType,
      isGift: purchase.isGift,
    })),
  ]
    .sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate))
    .slice(0, 10);

  return {
    totalIncomeCents,
    totalExpensesCents,
    netAmountCents,
    recentTransactions,
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
