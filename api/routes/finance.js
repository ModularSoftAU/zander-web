/**
 * api/routes/finance.js
 *
 * Finance module API routes.
 * Token-authenticated (handled by middleware — no per-route permission check needed).
 *
 *   GET  /api/finance/vendors/search?q=          — typeahead vendor search
 *   GET  /api/finance/accounts                   — list accounts with computed balance
 *   GET  /api/finance/categories                 — list categories
 *   GET  /api/finance/invoices/open?vendorId=    — unpaid + overdue invoices
 *   POST /api/finance/vendors/:vendorId/refresh-favicon — trigger favicon refresh
 *   GET  /api/finance/dashboard                  — dashboard summary JSON
 */

import {
  getVendors,
  getAccounts,
  computeAccountBalance,
  getCategories,
  getInvoices,
  fetchAndCacheVendorFavicon,
  getFinanceDashboardData,
} from "../../controllers/financeController.js";
import { prisma } from "../../controllers/databaseController.js";

export default function financeApiRoute(app, config, db, features, lang) {

  // ===========================================================================
  // GET /api/finance/vendors/search?q= — typeahead vendor search
  // ===========================================================================
  app.get("/api/finance/vendors/search", async function (req, res) {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 1) {
      return res.send({ success: true, data: [] });
    }

    try {
      const vendors = await prisma.financeVendors.findMany({
        where: {
          name: { contains: q },
          isActive: 1,
        },
        select: { vendorId: true, name: true, faviconUrl: true },
        orderBy: { name: "asc" },
        take: 15,
      });
      return res.send({ success: true, data: vendors });
    } catch (error) {
      console.error("[finance] GET /api/finance/vendors/search:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error.message}` });
    }
  });

  // ===========================================================================
  // GET /api/finance/accounts — list accounts with computed balance
  // ===========================================================================
  app.get("/api/finance/accounts", async function (req, res) {
    try {
      const accounts = await getAccounts();
      const accountsWithBalance = await Promise.all(
        accounts.map(async (account) => ({
          ...account,
          balanceCents: await computeAccountBalance(account.accountId),
        }))
      );
      return res.send({ success: true, data: accountsWithBalance });
    } catch (error) {
      console.error("[finance] GET /api/finance/accounts:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error.message}` });
    }
  });

  // ===========================================================================
  // GET /api/finance/categories — list categories
  // ===========================================================================
  app.get("/api/finance/categories", async function (req, res) {
    try {
      const categories = await getCategories();
      return res.send({ success: true, data: categories });
    } catch (error) {
      console.error("[finance] GET /api/finance/categories:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error.message}` });
    }
  });

  // ===========================================================================
  // GET /api/finance/invoices/open?vendorId= — unpaid + overdue invoices
  // ===========================================================================
  app.get("/api/finance/invoices/open", async function (req, res) {
    const vendorId = req.query.vendorId ? parseInt(req.query.vendorId, 10) : null;

    try {
      const [pendingInvoices, overdueInvoices] = await Promise.all([
        getInvoices({ vendorId: vendorId || undefined, status: "pending", limit: 100 }),
        getInvoices({ vendorId: vendorId || undefined, status: "overdue", limit: 100 }),
      ]);

      const partial = await getInvoices({ vendorId: vendorId || undefined, status: "partial", limit: 100 });

      const data = [...overdueInvoices, ...pendingInvoices, ...partial].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

      return res.send({ success: true, data });
    } catch (error) {
      console.error("[finance] GET /api/finance/invoices/open:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error.message}` });
    }
  });

  // ===========================================================================
  // POST /api/finance/vendors/:vendorId/refresh-favicon — trigger favicon refresh
  // ===========================================================================
  app.post("/api/finance/vendors/:vendorId/refresh-favicon", async function (req, res) {
    const vendorId = parseInt(req.params.vendorId, 10);
    if (!vendorId) return res.send({ success: false, message: "Invalid vendor id." });

    try {
      const faviconUrl = await fetchAndCacheVendorFavicon(vendorId);
      if (faviconUrl) {
        return res.send({ success: true, message: "Favicon refreshed.", data: { faviconUrl } });
      } else {
        return res.send({ success: false, message: "Could not fetch favicon — check the vendor website URL." });
      }
    } catch (error) {
      console.error("[finance] POST /api/finance/vendors/:vendorId/refresh-favicon:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error.message}` });
    }
  });

  // ===========================================================================
  // GET /api/finance/dashboard — dashboard summary JSON
  // ===========================================================================
  app.get("/api/finance/dashboard", async function (req, res) {
    try {
      const data = await getFinanceDashboardData();
      return res.send({ success: true, data });
    } catch (error) {
      console.error("[finance] GET /api/finance/dashboard:", error);
      if (!res.sent) return res.status(500).send({ success: false, message: `${error.message}` });
    }
  });

}
