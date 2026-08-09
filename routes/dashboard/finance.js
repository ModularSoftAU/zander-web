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

import {
  // Categories
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Transactions
  getTransactions,
  getTransactionCount,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  // Budget
  getAllBudgetEntries,
  createBudgetEntry,
  updateBudgetEntry,
  deleteBudgetEntry,
  getBudgetVsActual,
  // Dashboard
  getFinanceDashboardData,
  getFinanceMonthlyGoalCents,
  buildPublicFinanceSnapshot,
  getFinanceReportRecord,
  getPublishedFinanceReports,
  publishFinanceMonthlyReport,
  lockFinanceMonthlyReport,
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

  function redirectRetiredFinanceSection(res) {
    setBannerCookie("info", "This finance section has been folded into the main Finance page.", res);
    return res.redirect("/dashboard/finance");
  }

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
      setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard");
    }
  });

  // ===========================================================================
  // Transactions
  // ===========================================================================

  // GET /dashboard/finance/transactions
  app.get("/dashboard/finance/transactions", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // GET /dashboard/finance/transactions/create
  app.get("/dashboard/finance/transactions/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // POST /dashboard/finance/transactions/create
  app.post("/dashboard/finance/transactions/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // GET /dashboard/finance/transactions/:transactionId/edit
  app.get("/dashboard/finance/transactions/:transactionId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // POST /dashboard/finance/transactions/:transactionId/edit
  app.post("/dashboard/finance/transactions/:transactionId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // POST /dashboard/finance/transactions/:transactionId/delete
  app.post("/dashboard/finance/transactions/:transactionId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // ===========================================================================
  // Budget
  // ===========================================================================

  // GET /dashboard/finance/budget
  app.get("/dashboard/finance/budget", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // POST /dashboard/finance/budget/create
  app.post("/dashboard/finance/budget/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // POST /dashboard/finance/budget/:budgetId/edit
  app.post("/dashboard/finance/budget/:budgetId/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // POST /dashboard/finance/budget/:budgetId/delete
  app.post("/dashboard/finance/budget/:budgetId/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    return redirectRetiredFinanceSection(res);
  });

  // ===========================================================================
  // Reports
  // ===========================================================================

  app.get("/dashboard/finance/reports", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    try {
      const now = new Date();
      const selectedYear = parseInt(req.query.year, 10) || now.getFullYear();
      const selectedMonth = parseInt(req.query.month, 10) || now.getMonth() + 1;
      const monthlyGoalCents = getFinanceMonthlyGoalCents(config);

      const [base, existingReport, publishedReports, previewData] = await Promise.all([
        baseViewData(req, features),
        getFinanceReportRecord(selectedYear, selectedMonth),
        getPublishedFinanceReports(12),
        req.query.preview === "1"
          ? buildPublicFinanceSnapshot({
            year: selectedYear,
            month: selectedMonth,
            monthlyGoalCents,
            publicNote: req.query.publicNote || null,
          })
          : null,
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/reports", {
          pageTitle: "Finance - Reports",
          config,
          req,
          features,
          ...base,
          selectedYear,
          selectedMonth,
          monthlyGoalCents,
          existingReport,
          publishedReports,
          previewData,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/reports:", error);
      setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  app.post("/dashboard/finance/reports/publish", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      setBannerCookie("danger", "You do not have permission to publish finance reports.", res);
      return res.redirect("/dashboard/finance/reports");
    }

    try {
      const { year, month, publicNote } = req.body || {};
      await publishFinanceMonthlyReport({
        year,
        month,
        monthlyGoalCents: getFinanceMonthlyGoalCents(config),
        publicNote,
        publishedByUserId: req.session?.user?.userId || 0,
      });
      setBannerCookie("success", "Finance report published.", res);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/reports/publish:", error);
      setBannerCookie("danger", error.message, res);
    }

    return res.redirect(`/dashboard/finance/reports?year=${encodeURIComponent(req.body?.year || "")}&month=${encodeURIComponent(req.body?.month || "")}`);
  });

  app.post("/dashboard/finance/reports/lock", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      setBannerCookie("danger", "You do not have permission to lock finance reports.", res);
      return res.redirect("/dashboard/finance/reports");
    }

    try {
      const { year, month } = req.body || {};
      await lockFinanceMonthlyReport(year, month);
      setBannerCookie("success", "Finance report locked.", res);
    } catch (error) {
      console.error("[finance] POST /dashboard/finance/reports/lock:", error);
      setBannerCookie("danger", error.message, res);
    }

    return res.redirect(`/dashboard/finance/reports?year=${encodeURIComponent(req.body?.year || "")}&month=${encodeURIComponent(req.body?.month || "")}`);
  });

  // ===========================================================================
  // Settings (categories only)
  // ===========================================================================

  // GET /dashboard/finance/settings
  app.get("/dashboard/finance/settings", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;

    if (!canManageFinance(req)) {
      setBannerCookie("danger", "You do not have permission to access finance settings.", res);
      return res.redirect("/dashboard/finance");
    }

    try {
      const [base, categories] = await Promise.all([
        baseViewData(req, features),
        getCategories(),
      ]);

      res.header("content-type", "text/html; charset=utf-8").send(
        await app.view("dashboard/finance/settings", {
          pageTitle: "Finance - Settings",
          config,
          req,
          features,
          ...base,
          categories,
        })
      );
    } catch (error) {
      console.error("[finance] GET /dashboard/finance/settings:", error);
      setBannerCookie("danger", error.message, res);
      return res.redirect("/dashboard/finance");
    }
  });

  // ---- Categories ----

  app.post("/dashboard/finance/settings/categories/create", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    try {
      const { parentId, name, type, color } = req.body || {};
      await createCategory({ parentId, name, type, color });
      setBannerCookie("success", "Category created.", res);
    } catch (error) {
      console.error("[finance] POST settings/categories/create:", error);
      setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/categories/:id/edit", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      const {
        parentId,
        name,
        type,
        color,
        isActive,
        isPublic,
        publicName,
        publicDescription,
        publicSortOrder,
      } = req.body || {};
      await updateCategory(id, {
        parentId,
        name,
        type,
        color,
        isActive: isActive === "1" ? 1 : 0,
        isPublic: isPublic === "1" ? 1 : 0,
        publicName,
        publicDescription,
        publicSortOrder,
      });
      setBannerCookie("success", "Category updated.", res);
    } catch (error) {
      console.error("[finance] POST settings/categories/:id/edit:", error);
      setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

  app.post("/dashboard/finance/settings/categories/:id/delete", async function (req, res) {
    if (!await hasPermission("zander.web.finance", req, res, features)) return;
    if (!canManageFinance(req)) {
      setBannerCookie("danger", "Permission denied.", res);
      return res.redirect("/dashboard/finance/settings");
    }
    const id = parseInt(req.params.id, 10);
    try {
      await deleteCategory(id);
      setBannerCookie("success", "Category deleted.", res);
    } catch (error) {
      console.error("[finance] POST settings/categories/:id/delete:", error);
      setBannerCookie("danger", error.message, res);
    }
    return res.redirect("/dashboard/finance/settings");
  });

}
