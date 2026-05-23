/**
 * routes/dashboard/finance.js
 *
 * Dashboard routes for the Finance Management module.
 *
 * All GET routes render EJS views.
 * All POST routes validate, call controller functions, set banner cookies and redirect.
 *
 * Permission nodes:
 *   zander.web.finance         — view access
 *   zander.web.finance.manage  — create / edit / delete access
 */

import { hasPermission, setBannerCookie } from "../../api/common.js";
import { adminViewData } from "../../admin/adminHelpers.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { uploadImage } from "../../services/cloudinaryService.js";

import {
  // Accounts
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  computeAccountBalance,
  // Categories
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Tags
  getTags,
  createTag,
  deleteTag,
  // Vendors
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorStats,
  fetchAndCacheVendorFavicon,
  // Transactions
  getTransactions,
  getTransactionCount,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  // Invoices
  getInvoices,
  getInvoiceCount,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recalculateInvoiceStatus,
  // Payments
  getPayments,
  getPaymentCount,
  createPayment,
  deletePayment,
  // Attachments
  getAttachments,
  createAttachment,
  deleteAttachment,
  // Budget
  getOperationsBudget,
  getAllBudgetEntries,
  createBudgetEntry,
  updateBudgetEntry,
  deleteBudgetEntry,
  getBudgetVsActual,
  // Reports
  getMonthlyReports,
  getMonthlyReport,
  generateMonthlyReportData,
  upsertMonthlyReport,
  publishMonthlyReport,
  // Dashboard
  getFinanceDashboardData,
  // Helpers
  centsToDisplay,
} from "../../controllers/financeController.js";

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

function canManageFinance(req) {
  const perms = req.session?.user?.permissions ?? [];
  return perms.some((p) => {
    const c = String(p).trim().toLowerCase();
    return c === "*" || c === "zander.web.finance.manage" || c === "zander.web.finance.*";
  });
}

// ---------------------------------------------------------------------------
// View data helper — builds the base object every finance view needs
// ---------------------------------------------------------------------------

async function baseViewData(req, features) {
  const [announcementWeb] = await Promise.all([getWebAnnouncement()]);
  return {
    ...adminViewData(req, features),
    announcementWeb,
    canManage: canManageFinance(req),
    centsToDisplay,
  };
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

function getPagination(query, defaultLimit = 50) {
  const limit = Math.min(parseInt(query.limit, 10) || defaultLimit, 200);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, page, offset };
}

// =============================================================================
// Route registrations
// =============================================================================

export default function dashboardFinanceRoute(app, fetch, config, db, features, lang) {

  // ===========================================================================
  // GET /dashboard/finance — dashboard overview
  // ===========================================================================
  app.get("/dashboard/finance", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const [base, dashData] = await Promise.all([
        baseViewData(req, features),
        getFinanceDashboardData(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/index", {
          pageTitle: "Dashboard - Finance",
          config,
          req,
          features,
          ...base,
          ...dashData,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard");
    }
  });

  // ===========================================================================
  // Vendors
  // ===========================================================================

  // GET /dashboard/finance/vendors
  app.get("/dashboard/finance/vendors", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const statusFilter = req.query?.status ?? null;
      const activeOnly = statusFilter === "active";
      const [base, vendors] = await Promise.all([
        baseViewData(req, features),
        getVendors(activeOnly ? { activeOnly: true } : {}),
      ]);

      let vendorsFiltered = vendors;
      if (statusFilter === "inactive") {
        vendorsFiltered = vendors.filter((v) => !v.isActive);
      }

      const vendorsWithStats = await Promise.all(
        vendorsFiltered.map(async (vendor) => {
          const stats = await getVendorStats(vendor.vendorId);
          return { ...vendor, ...stats };
        })
      );

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/vendors", {
          pageTitle: "Finance - Vendors",
          config,
          req,
          features,
          ...base,
          statusFilter,
          vendors: vendorsWithStats,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/vendors:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // GET /dashboard/finance/vendors/create
  app.get("/dashboard/finance/vendors/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const canManage = canManageFinance(req);
    if (!canManage) {
      await setBannerCookie("danger", "You do not have permission to create vendors.", res);
      return res.redirect("/dashboard/finance/vendors");
    }

    try {
      const [base, categories] = await Promise.all([
        baseViewData(req, features),
        getCategories(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/vendor-create", {
          pageTitle: "Finance - Create Vendor",
          config,
          req,
          features,
          ...base,
          categories,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/vendors/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/vendors");
    }
  });

  // POST /dashboard/finance/vendors/create
  app.post("/dashboard/finance/vendors/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to create vendors.", res);
      return res.redirect("/dashboard/finance/vendors");
    }

    try {
      const { name, website, contactEmail, notes, categoryId } = req.body || {};
      const vendor = await createVendor({ name, website, contactEmail, notes, categoryId });

      if (vendor.website) {
        setImmediate(() => fetchAndCacheVendorFavicon(vendor.vendorId));
      }

      await setBannerCookie("success", `Vendor "${vendor.name}" created successfully.`, res);
      return res.redirect("/dashboard/finance/vendors");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/vendors/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/vendors/create");
    }
  });

  // GET /dashboard/finance/vendors/:vendorId
  app.get("/dashboard/finance/vendors/:vendorId", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const vendorId = parseInt(req.params.vendorId, 10);
    if (!vendorId) return res.redirect("/dashboard/finance/vendors");

    try {
      const [base, vendor, stats, invoices, payments, attachments] = await Promise.all([
        baseViewData(req, features),
        getVendorById(vendorId),
        getVendorStats(vendorId),
        getInvoices({ vendorId, limit: 20 }),
        getPayments({ vendorId, limit: 20 }),
        getAttachments({ vendorId }).catch(() => []),
      ]);

      if (!vendor) {
        await setBannerCookie("danger", "Vendor not found.", res);
        return res.redirect("/dashboard/finance/vendors");
      }

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/vendor-detail", {
          pageTitle: `Finance - ${vendor.name}`,
          config,
          req,
          features,
          ...base,
          vendor: { ...vendor, ...stats },
          invoices,
          payments,
          attachments,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/vendors/:vendorId:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/vendors");
    }
  });

  // GET /dashboard/finance/vendors/:vendorId/edit
  app.get("/dashboard/finance/vendors/:vendorId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const vendorId = parseInt(req.params.vendorId, 10);
    if (!vendorId) return res.redirect("/dashboard/finance/vendors");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to edit vendors.", res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }

    try {
      const [base, vendor, categories] = await Promise.all([
        baseViewData(req, features),
        getVendorById(vendorId),
        getCategories(),
      ]);

      if (!vendor) {
        await setBannerCookie("danger", "Vendor not found.", res);
        return res.redirect("/dashboard/finance/vendors");
      }

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/vendor-edit", {
          pageTitle: `Finance - Edit ${vendor.name}`,
          config,
          req,
          features,
          ...base,
          vendor,
          categories,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/vendors/:vendorId/edit:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }
  });

  // POST /dashboard/finance/vendors/:vendorId/edit
  app.post("/dashboard/finance/vendors/:vendorId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const vendorId = parseInt(req.params.vendorId, 10);
    if (!vendorId) return res.redirect("/dashboard/finance/vendors");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to edit vendors.", res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }

    try {
      const { name, website, contactEmail, notes, categoryId, isActive } = req.body || {};
      await updateVendor(vendorId, { name, website, contactEmail, notes, categoryId, isActive: isActive === "1" ? 1 : 0 });
      await setBannerCookie("success", "Vendor updated successfully.", res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/vendors/:vendorId/edit:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}/edit`);
    }
  });

  // POST /dashboard/finance/vendors/:vendorId/delete
  app.post("/dashboard/finance/vendors/:vendorId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const vendorId = parseInt(req.params.vendorId, 10);
    if (!vendorId) return res.redirect("/dashboard/finance/vendors");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to delete vendors.", res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }

    try {
      await deleteVendor(vendorId);
      await setBannerCookie("success", "Vendor deleted.", res);
      return res.redirect("/dashboard/finance/vendors");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/vendors/:vendorId/delete:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }
  });

  // POST /dashboard/finance/vendors/:vendorId/refresh-favicon
  app.post("/dashboard/finance/vendors/:vendorId/refresh-favicon", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const vendorId = parseInt(req.params.vendorId, 10);
    if (!vendorId) return res.redirect("/dashboard/finance/vendors");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to refresh vendor favicons.", res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }

    try {
      const faviconUrl = await fetchAndCacheVendorFavicon(vendorId);
      if (faviconUrl) {
        await setBannerCookie("success", "Favicon refreshed successfully.", res);
      } else {
        await setBannerCookie("warning", "Could not fetch favicon — check that the vendor has a valid website URL.", res);
      }
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/vendors/:vendorId/refresh-favicon:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/vendors/${vendorId}`);
    }
  });

  // ===========================================================================
  // Invoices
  // ===========================================================================

  // GET /dashboard/finance/invoices
  app.get("/dashboard/finance/invoices", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const { limit, page, offset } = getPagination(req.query);
      const statusFilter = req.query.status || null;
      const filters = { status: statusFilter, limit, offset };

      const [base, invoices, total] = await Promise.all([
        baseViewData(req, features),
        getInvoices(filters),
        getInvoiceCount({ status: statusFilter }),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/invoices", {
          pageTitle: "Finance - Invoices",
          config,
          req,
          features,
          ...base,
          invoices,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          statusFilter,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/invoices:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // GET /dashboard/finance/invoices/create
  app.get("/dashboard/finance/invoices/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to create invoices.", res);
      return res.redirect("/dashboard/finance/invoices");
    }

    try {
      const [base, vendors] = await Promise.all([
        baseViewData(req, features),
        getVendors({ activeOnly: true }),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/invoice-create", {
          pageTitle: "Finance - Create Invoice",
          config,
          req,
          features,
          ...base,
          vendors,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/invoices/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/invoices");
    }
  });

  // POST /dashboard/finance/invoices/create
  app.post("/dashboard/finance/invoices/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to create invoices.", res);
      return res.redirect("/dashboard/finance/invoices");
    }

    try {
      const { vendorId, invoiceNumber, issueDate, dueDate, amountCents, currency, description } = req.body || {};
      if (!vendorId) throw new Error("Vendor is required.");

      const createdByUserId = req.session?.user?.userId || 0;
      const invoice = await createInvoice({ vendorId, invoiceNumber, issueDate, dueDate, amountCents, currency, description, createdByUserId });

      await setBannerCookie("success", `Invoice #${invoice.invoiceNumber || invoice.invoiceId} created.`, res);
      return res.redirect(`/dashboard/finance/invoices/${invoice.invoiceId}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/invoices/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/invoices/create");
    }
  });

  // GET /dashboard/finance/invoices/:invoiceId
  app.get("/dashboard/finance/invoices/:invoiceId", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (!invoiceId) return res.redirect("/dashboard/finance/invoices");

    try {
      const [base, invoice, payments, attachments, accounts] = await Promise.all([
        baseViewData(req, features),
        getInvoiceById(invoiceId),
        getPayments({ invoiceId, limit: 50 }),
        getAttachments({ invoiceId }).catch(() => []),
        getAccounts(),
      ]);

      if (!invoice) {
        await setBannerCookie("danger", "Invoice not found.", res);
        return res.redirect("/dashboard/finance/invoices");
      }

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/invoice-detail", {
          pageTitle: `Finance - Invoice ${invoice.invoiceNumber || `#${invoice.invoiceId}`}`,
          config,
          req,
          features,
          ...base,
          invoice,
          payments,
          attachments,
          accounts,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/invoices/:invoiceId:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/invoices");
    }
  });

  // POST /dashboard/finance/invoices/:invoiceId/edit
  app.post("/dashboard/finance/invoices/:invoiceId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (!invoiceId) return res.redirect("/dashboard/finance/invoices");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to edit invoices.", res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    }

    try {
      const { vendorId, invoiceNumber, issueDate, dueDate, amountCents, currency, description, status } = req.body || {};
      await updateInvoice(invoiceId, { vendorId, invoiceNumber, issueDate, dueDate, amountCents, currency, description, status });
      await recalculateInvoiceStatus(invoiceId);
      await setBannerCookie("success", "Invoice updated.", res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/invoices/:invoiceId/edit:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    }
  });

  // POST /dashboard/finance/invoices/:invoiceId/delete
  app.post("/dashboard/finance/invoices/:invoiceId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (!invoiceId) return res.redirect("/dashboard/finance/invoices");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to delete invoices.", res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    }

    try {
      await deleteInvoice(invoiceId);
      await setBannerCookie("success", "Invoice deleted.", res);
      return res.redirect("/dashboard/finance/invoices");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/invoices/:invoiceId/delete:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    }
  });

  // POST /dashboard/finance/invoices/:invoiceId/mark-cancelled
  app.post("/dashboard/finance/invoices/:invoiceId/mark-cancelled", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (!invoiceId) return res.redirect("/dashboard/finance/invoices");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to cancel invoices.", res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    }

    try {
      await updateInvoice(invoiceId, { status: "cancelled" });
      await setBannerCookie("success", "Invoice marked as cancelled.", res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/invoices/:invoiceId/mark-cancelled:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/invoices/${invoiceId}`);
    }
  });

  // ===========================================================================
  // Payments
  // ===========================================================================

  // GET /dashboard/finance/payments
  app.get("/dashboard/finance/payments", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const { limit, page, offset } = getPagination(req.query);
      const vendorIdFilter = req.query.vendorId ? parseInt(req.query.vendorId, 10) : null;
      const filters = { vendorId: vendorIdFilter, limit, offset };

      const [base, payments, total] = await Promise.all([
        baseViewData(req, features),
        getPayments(filters),
        getPaymentCount({ vendorId: vendorIdFilter }),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/payments", {
          pageTitle: "Finance - Payments",
          config,
          req,
          features,
          ...base,
          payments,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          vendorIdFilter,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/payments:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // GET /dashboard/finance/payments/create
  app.get("/dashboard/finance/payments/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to record payments.", res);
      return res.redirect("/dashboard/finance/payments");
    }

    try {
      const [base, vendors, openInvoices, accounts] = await Promise.all([
        baseViewData(req, features),
        getVendors({ activeOnly: true }),
        getInvoices({ limit: 200, offset: 0 }),
        getAccounts(),
      ]);

      // Filter to unpaid/partial invoices
      const pendingInvoices = openInvoices.filter((i) => ["pending", "partial", "overdue"].includes(i.status));

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/payment-create", {
          pageTitle: "Finance - Record Payment",
          config,
          req,
          features,
          ...base,
          vendors,
          pendingInvoices,
          accounts,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/payments/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/payments");
    }
  });

  // POST /dashboard/finance/payments/create
  app.post("/dashboard/finance/payments/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to record payments.", res);
      return res.redirect("/dashboard/finance/payments");
    }

    try {
      const { vendorId, invoiceId, accountId, amountCents, currency, paidDate, notes } = req.body || {};
      if (!vendorId) throw new Error("Vendor is required.");
      if (!accountId) throw new Error("Account is required.");
      if (!paidDate) throw new Error("Payment date is required.");

      const createdByUserId = req.session?.user?.userId || 0;

      // Optionally create a linked transaction
      let transactionId = null;
      if (accountId && amountCents) {
        try {
          const tx = await createTransaction({
            type: "expense",
            amountCents,
            currency,
            accountId,
            vendorId,
            description: `Payment to vendor #${vendorId}${invoiceId ? ` (Invoice #${invoiceId})` : ""}`,
            transactionDate: paidDate,
            createdByUserId,
          });
          transactionId = tx.transactionId;
        } catch (txError) {
          console.warn("[finance] Could not auto-create linked transaction:", txError.message);
        }
      }

      await createPayment({ vendorId, invoiceId, transactionId, accountId, amountCents, currency, paidDate, notes, createdByUserId });

      await setBannerCookie("success", "Payment recorded successfully.", res);
      return res.redirect("/dashboard/finance/payments");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/payments/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/payments/create");
    }
  });

  // POST /dashboard/finance/payments/:paymentId/delete
  app.post("/dashboard/finance/payments/:paymentId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const paymentId = parseInt(req.params.paymentId, 10);
    if (!paymentId) return res.redirect("/dashboard/finance/payments");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to delete payments.", res);
      return res.redirect("/dashboard/finance/payments");
    }

    try {
      await deletePayment(paymentId);
      await setBannerCookie("success", "Payment deleted.", res);
      return res.redirect("/dashboard/finance/payments");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/payments/:paymentId/delete:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/payments");
    }
  });

  // ===========================================================================
  // Transactions
  // ===========================================================================

  // GET /dashboard/finance/transactions
  app.get("/dashboard/finance/transactions", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const { limit, page, offset } = getPagination(req.query);
      const filters = {
        type: req.query.type || null,
        accountId: req.query.accountId || null,
        categoryId: req.query.categoryId || null,
        vendorId: req.query.vendorId || null,
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
        limit,
        offset,
      };

      const [base, transactions, total, accounts, categories] = await Promise.all([
        baseViewData(req, features),
        getTransactions(filters),
        getTransactionCount(filters),
        getAccounts(),
        getCategories(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/transactions", {
          pageTitle: "Finance - Transactions",
          config,
          req,
          features,
          ...base,
          transactions,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          accounts,
          categories,
          filters: req.query,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/transactions:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // GET /dashboard/finance/transactions/create
  app.get("/dashboard/finance/transactions/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to create transactions.", res);
      return res.redirect("/dashboard/finance/transactions");
    }

    try {
      const [base, accounts, categories, vendors, tags] = await Promise.all([
        baseViewData(req, features),
        getAccounts(),
        getCategories(),
        getVendors({ activeOnly: true }),
        getTags(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/transaction-create", {
          pageTitle: "Finance - Create Transaction",
          config,
          req,
          features,
          ...base,
          accounts,
          categories,
          vendors,
          tags,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/transactions/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/transactions");
    }
  });

  // POST /dashboard/finance/transactions/create
  app.post("/dashboard/finance/transactions/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to create transactions.", res);
      return res.redirect("/dashboard/finance/transactions");
    }

    try {
      const { type, amountCents, currency, accountId, toAccountId, categoryId, vendorId, description, notes, transactionDate } = req.body || {};
      if (!type) throw new Error("Transaction type is required.");
      if (!amountCents || parseInt(amountCents, 10) <= 0) throw new Error("Amount must be greater than 0.");
      if (!accountId) throw new Error("Account is required.");
      if (!transactionDate) throw new Error("Transaction date is required.");

      // tagIds may be comma-separated or an array
      let tagIds = req.body.tagIds || [];
      if (typeof tagIds === "string") tagIds = tagIds.split(",").filter(Boolean);

      const createdByUserId = req.session?.user?.userId || 0;

      const transaction = await createTransaction({
        type, amountCents, currency, accountId, toAccountId,
        categoryId, vendorId, description, notes, transactionDate,
        tagIds, createdByUserId,
      });

      await setBannerCookie("success", "Transaction created successfully.", res);
      return res.redirect("/dashboard/finance/transactions");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/transactions/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/transactions/create");
    }
  });

  // GET /dashboard/finance/transactions/:transactionId
  app.get("/dashboard/finance/transactions/:transactionId", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const transactionId = parseInt(req.params.transactionId, 10);
    if (!transactionId) return res.redirect("/dashboard/finance/transactions");

    try {
      const [base, transaction, attachments] = await Promise.all([
        baseViewData(req, features),
        getTransactionById(transactionId),
        getAttachments({ transactionId }).catch(() => []),
      ]);

      if (!transaction) {
        await setBannerCookie("danger", "Transaction not found.", res);
        return res.redirect("/dashboard/finance/transactions");
      }

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/transaction-detail", {
          pageTitle: `Finance - Transaction #${transaction.transactionId}`,
          config,
          req,
          features,
          ...base,
          transaction,
          attachments,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/transactions/:transactionId:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/transactions");
    }
  });

  // POST /dashboard/finance/transactions/:transactionId/edit
  app.post("/dashboard/finance/transactions/:transactionId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const transactionId = parseInt(req.params.transactionId, 10);
    if (!transactionId) return res.redirect("/dashboard/finance/transactions");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to edit transactions.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }

    try {
      const { type, amountCents, currency, accountId, toAccountId, categoryId, vendorId, description, notes, transactionDate } = req.body || {};

      let tagIds = req.body.tagIds || [];
      if (typeof tagIds === "string") tagIds = tagIds.split(",").filter(Boolean);

      await updateTransaction(transactionId, {
        type, amountCents, currency, accountId, toAccountId,
        categoryId, vendorId, description, notes, transactionDate, tagIds,
      });

      await setBannerCookie("success", "Transaction updated.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    } catch (error) {
      if (error.message === "locked") {
        await setBannerCookie("danger", "This transaction is locked and cannot be edited.", res);
      } else {
        console.error("[finance] POST /dashboard/finance/transactions/:transactionId/edit:", error);
        await setBannerCookie("danger", error.message, res);
      }
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }
  });

  // POST /dashboard/finance/transactions/:transactionId/delete
  app.post("/dashboard/finance/transactions/:transactionId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const transactionId = parseInt(req.params.transactionId, 10);
    if (!transactionId) return res.redirect("/dashboard/finance/transactions");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to delete transactions.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }

    try {
      await deleteTransaction(transactionId);
      await setBannerCookie("success", "Transaction deleted.", res);
      return res.redirect("/dashboard/finance/transactions");
    } catch (error) {
      if (error.message === "locked") {
        await setBannerCookie("danger", "This transaction is locked and cannot be deleted.", res);
      } else {
        console.error("[finance] POST /dashboard/finance/transactions/:transactionId/delete:", error);
        await setBannerCookie("danger", error.message, res);
      }
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }
  });

  // POST /dashboard/finance/transactions/:transactionId/upload
  app.post("/dashboard/finance/transactions/:transactionId/upload", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const transactionId = parseInt(req.params.transactionId, 10);
    if (!transactionId) return res.redirect("/dashboard/finance/transactions");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to upload attachments.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }

    try {
      const data = await req.file();
      if (!data) throw new Error("No file uploaded.");

      const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        throw new Error("Only PDF and image files are allowed.");
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error("File size must be under 10 MB.");
      }

      const uploadedByUserId = req.session?.user?.userId || 0;
      const result = await uploadImage(buffer, { folder: "zander/finance", resourceType: "raw" });

      await createAttachment({
        transactionId,
        fileName: data.filename,
        fileUrl: result.url,
        filePublicId: result.publicId,
        mimeType: data.mimetype,
        fileSizeBytes: buffer.length,
        label: req.body?.label || null,
        uploadedByUserId,
      });

      await setBannerCookie("success", "Attachment uploaded successfully.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/transactions/:transactionId/upload:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }
  });

  // POST /dashboard/finance/transactions/:transactionId/attachments/:attachmentId/delete
  app.post("/dashboard/finance/transactions/:transactionId/attachments/:attachmentId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const transactionId = parseInt(req.params.transactionId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to delete attachments.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }

    try {
      const attachment = await deleteAttachment(attachmentId);
      if (attachment.filePublicId) {
        console.info(`[finance] Attachment deleted — Cloudinary publicId for manual cleanup: ${attachment.filePublicId}`);
      }
      await setBannerCookie("success", "Attachment deleted.", res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    } catch (error) {
      console.error("[finance] POST …/attachments/:attachmentId/delete:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/transactions/${transactionId}`);
    }
  });

  // ===========================================================================
  // Budget
  // ===========================================================================

  // GET /dashboard/finance/budget
  app.get("/dashboard/finance/budget", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const [base, budgetVsActual, allEntries, vendors, categories] = await Promise.all([
        baseViewData(req, features),
        getBudgetVsActual(currentYear, currentMonth),
        getAllBudgetEntries(),
        getVendors({ activeOnly: true }),
        getCategories(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/budget", {
          pageTitle: "Finance - Operations Budget",
          config,
          req,
          features,
          ...base,
          budgetVsActual,
          allEntries,
          vendors,
          categories,
          currentYear,
          currentMonth,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/budget:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // POST /dashboard/finance/budget/create
  app.post("/dashboard/finance/budget/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to manage budget entries.", res);
      return res.redirect("/dashboard/finance/budget");
    }

    try {
      const { vendorId, categoryId, label, monthlyBudgetCents, currency, notes } = req.body || {};
      await createBudgetEntry({ vendorId, categoryId, label, monthlyBudgetCents, currency, notes });
      await setBannerCookie("success", "Budget entry created.", res);
      return res.redirect("/dashboard/finance/budget");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/budget/create:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/budget");
    }
  });

  // POST /dashboard/finance/budget/:budgetId/edit
  app.post("/dashboard/finance/budget/:budgetId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const budgetId = parseInt(req.params.budgetId, 10);
    if (!budgetId) return res.redirect("/dashboard/finance/budget");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to manage budget entries.", res);
      return res.redirect("/dashboard/finance/budget");
    }

    try {
      const { vendorId, categoryId, label, monthlyBudgetCents, currency, notes, isActive } = req.body || {};
      await updateBudgetEntry(budgetId, { vendorId, categoryId, label, monthlyBudgetCents, currency, notes, isActive: isActive === "1" ? 1 : 0 });
      await setBannerCookie("success", "Budget entry updated.", res);
      return res.redirect("/dashboard/finance/budget");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/budget/:budgetId/edit:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/budget");
    }
  });

  // POST /dashboard/finance/budget/:budgetId/delete
  app.post("/dashboard/finance/budget/:budgetId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const budgetId = parseInt(req.params.budgetId, 10);
    if (!budgetId) return res.redirect("/dashboard/finance/budget");

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to manage budget entries.", res);
      return res.redirect("/dashboard/finance/budget");
    }

    try {
      await deleteBudgetEntry(budgetId);
      await setBannerCookie("success", "Budget entry deleted.", res);
      return res.redirect("/dashboard/finance/budget");
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/budget/:budgetId/delete:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/budget");
    }
  });

  // ===========================================================================
  // Reports
  // ===========================================================================

  // GET /dashboard/finance/reports
  app.get("/dashboard/finance/reports", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const [base, reports] = await Promise.all([
        baseViewData(req, features),
        getMonthlyReports(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/reports", {
          pageTitle: "Finance - Monthly Reports",
          config,
          req,
          features,
          ...base,
          reports,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/reports:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // GET /dashboard/finance/reports/:year/:month
  app.get("/dashboard/finance/reports/:year/:month", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      await setBannerCookie("danger", "Invalid report period.", res);
      return res.redirect("/dashboard/finance/reports");
    }

    try {
      let report = await getMonthlyReport(year, month);
      if (!report) {
        const data = await generateMonthlyReportData(year, month);
        report = await upsertMonthlyReport(year, month, data);
        report.reportData = data;
      }

      const base = await baseViewData(req, features);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/report-detail", {
          pageTitle: `Finance - Report ${year}/${String(month).padStart(2, "0")}`,
          config,
          req,
          features,
          ...base,
          report,
          year,
          month,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/reports/:year/:month:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance/reports");
    }
  });

  // POST /dashboard/finance/reports/:year/:month/generate
  app.post("/dashboard/finance/reports/:year/:month/generate", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to generate reports.", res);
      return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
    }

    try {
      const existing = await getMonthlyReport(year, month);
      if (existing?.isLocked) {
        await setBannerCookie("danger", "This report is locked and cannot be regenerated.", res);
        return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
      }

      const data = await generateMonthlyReportData(year, month);
      await upsertMonthlyReport(year, month, data);

      await setBannerCookie("success", `Report for ${year}/${String(month).padStart(2, "0")} regenerated.`, res);
      return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/reports/:year/:month/generate:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
    }
  });

  // POST /dashboard/finance/reports/:year/:month/publish
  app.post("/dashboard/finance/reports/:year/:month/publish", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to publish reports.", res);
      return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
    }

    try {
      const report = await getMonthlyReport(year, month);
      if (!report) {
        await setBannerCookie("danger", "Report not found. Please generate it first.", res);
        return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
      }

      const userId = req.session?.user?.userId || 0;
      await publishMonthlyReport(report.reportId, userId);

      await setBannerCookie("success", `Report for ${year}/${String(month).padStart(2, "0")} published and locked.`, res);
      return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/reports/:year/:month/publish:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect(`/dashboard/finance/reports/${year}/${month}`);
    }
  });

  // ===========================================================================
  // Settings
  // ===========================================================================

  // GET /dashboard/finance/settings
  app.get("/dashboard/finance/settings", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "You do not have permission to access finance settings.", res);
      return res.redirect("/dashboard/finance");
    }

    try {
      const [base, accounts, categories, tags] = await Promise.all([
        baseViewData(req, features),
        getAccounts(),
        getCategories(),
        getTags(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/settings", {
          pageTitle: "Finance - Settings",
          config,
          req,
          features,
          ...base,
          accounts,
          categories,
          tags,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/settings:", error);
      await setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // ---- Accounts ----

  app.post("/dashboard/finance/settings/accounts/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    try {
      const { name, accountType, openingBalanceCents, currency, notes } = req.body || {};
      await createAccount({ name, accountType, openingBalanceCents, currency, notes });
      await setBannerCookie("success", "Account created.", res);
    } catch (error) {
      console.error("[finance] POST settings/accounts/create:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/accounts/:id/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      const { name, accountType, openingBalanceCents, currency, notes, isActive } = req.body || {};
      await updateAccount(id, { name, accountType, openingBalanceCents, currency, notes, isActive: isActive === "1" ? 1 : 0 });
      await setBannerCookie("success", "Account updated.", res);
    } catch (error) {
      console.error("[finance] POST settings/accounts/:id/edit:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/accounts/:id/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      await deleteAccount(id);
      await setBannerCookie("success", "Account deleted.", res);
    } catch (error) {
      console.error("[finance] POST settings/accounts/:id/delete:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  // ---- Categories ----

  app.post("/dashboard/finance/settings/categories/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    try {
      const { parentId, name, type, color } = req.body || {};
      await createCategory({ parentId, name, type, color });
      await setBannerCookie("success", "Category created.", res);
    } catch (error) {
      console.error("[finance] POST settings/categories/create:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/categories/:id/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      const { parentId, name, type, color, isActive } = req.body || {};
      await updateCategory(id, { parentId, name, type, color, isActive: isActive === "1" ? 1 : 0 });
      await setBannerCookie("success", "Category updated.", res);
    } catch (error) {
      console.error("[finance] POST settings/categories/:id/edit:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/categories/:id/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      await deleteCategory(id);
      await setBannerCookie("success", "Category deleted.", res);
    } catch (error) {
      console.error("[finance] POST settings/categories/:id/delete:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  // ---- Tags ----

  app.post("/dashboard/finance/settings/tags/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    try {
      const { name, color } = req.body || {};
      await createTag({ name, color });
      await setBannerCookie("success", "Tag created.", res);
    } catch (error) {
      console.error("[finance] POST settings/tags/create:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/tags/:id/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      await setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      await deleteTag(id);
      await setBannerCookie("success", "Tag deleted.", res);
    } catch (error) {
      console.error("[finance] POST settings/tags/:id/delete:", error);
      await setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

}
