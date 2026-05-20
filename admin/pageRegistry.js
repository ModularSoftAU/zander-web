/**
 * admin/pageRegistry.js
 *
 * Central admin page registry for Zander Web.
 *
 * Every admin screen that appears in the sidebar (or needs permission-gating)
 * is registered here.  The sidebar, breadcrumbs, and active-state detection
 * all derive from this single source of truth instead of being hardcoded in
 * multiple EJS templates.
 *
 * Fields
 * ------
 *  slug          – unique string identifier
 *  title         – full page title (used in <title> and page headers)
 *  menuTitle     – shorter label shown in the sidebar
 *  icon          – Font Awesome class string
 *  capability    – LuckPerms permission node required to see / access this page
 *  path          – canonical URL of the primary entry-point
 *  group         – sidebar section heading  (null / omitted → top-level)
 *  sortOrder     – render order within the group
 *  hiddenFromMenu– true → page exists but is NOT shown in the sidebar
 *  featureFlag   – key in features.json that must be truthy to show the item
 */

// ---------------------------------------------------------------------------
// Primary menu entries (visible in the sidebar)
// ---------------------------------------------------------------------------
export const adminPages = [
  // ── Top level ──────────────────────────────────────────────────────────────
  {
    slug: "dashboard",
    title: "Dashboard",
    menuTitle: "Overview",
    icon: "fas fa-home",
    capability: "zander.web.dashboard",
    path: "/dashboard",
    group: null,
    sortOrder: 0,
  },
  {
    slug: "announcements",
    title: "Announcements",
    menuTitle: "Announcements",
    icon: "fas fa-bullhorn",
    capability: "zander.web.announcements",
    path: "/dashboard/announcements",
    featureFlag: "announcements",
    group: null,
    sortOrder: 10,
  },
  {
    slug: "forums",
    title: "Forum Management",
    menuTitle: "Forums",
    icon: "fa-solid fa-comments",
    capability: "zander.web.forums",
    path: "/dashboard/forums/categories",
    featureFlag: "forums",
    group: null,
    sortOrder: 15,
  },

  // ── Community group ────────────────────────────────────────────────────────
  {
    slug: "servers",
    title: "Servers",
    menuTitle: "Servers",
    icon: "fas fa-server",
    capability: "zander.web.server",
    path: "/dashboard/servers",
    featureFlag: "server",
    group: "Community",
    sortOrder: 20,
  },
  {
    slug: "applications",
    title: "Applications",
    menuTitle: "Applications",
    icon: "fas fa-file-alt",
    capability: "zander.web.application",
    path: "/dashboard/applications",
    featureFlag: "applications",
    group: "Community",
    sortOrder: 21,
  },
  {
    slug: "forms",
    title: "Forms",
    menuTitle: "Forms",
    icon: "fas fa-poll",
    capability: "zander.web.forms",
    path: "/dashboard/forms",
    featureFlag: "forms",
    group: "Community",
    sortOrder: 22,
  },

  // ── Events group ───────────────────────────────────────────────────────────
  {
    slug: "events-calendar",
    title: "Events Calendar",
    menuTitle: "Calendar",
    icon: "fas fa-calendar-alt",
    capability: "zander.web.events",
    path: "/dashboard/events",
    featureFlag: "events",
    group: "Events",
    sortOrder: 30,
  },
  {
    slug: "events-list",
    title: "All Events",
    menuTitle: "All Events",
    icon: "fas fa-list",
    capability: "zander.web.events",
    path: "/dashboard/events/list",
    featureFlag: "events",
    group: "Events",
    sortOrder: 31,
  },
  {
    slug: "events-review",
    title: "Events Review Queue",
    menuTitle: "Review Queue",
    icon: "fas fa-clock",
    capability: "zander.web.events",
    path: "/dashboard/events/review",
    featureFlag: "events",
    group: "Events",
    sortOrder: 32,
  },
  {
    slug: "events-templates",
    title: "Event Templates",
    menuTitle: "Templates",
    icon: "fas fa-copy",
    capability: "zander.web.events",
    path: "/dashboard/events/templates",
    featureFlag: "events",
    group: "Events",
    sortOrder: 33,
  },

  // ── Moderation group ───────────────────────────────────────────────────────
  {
    slug: "web-punishments",
    title: "Web Punishments",
    menuTitle: "Web Punishments",
    icon: "fa-solid fa-gavel",
    capability: "zander.web.web-punishments",
    path: "/dashboard/web-punishments",
    group: "Moderation",
    sortOrder: 40,
  },

  // ── Support group ──────────────────────────────────────────────────────────
  {
    slug: "support-tickets",
    title: "Support Tickets",
    menuTitle: "Manage Tickets",
    icon: "fas fa-ticket-alt",
    capability: "zander.web.ticket",
    path: "/dashboard/support",
    featureFlag: "support",
    group: "Support",
    sortOrder: 50,
  },
  {
    slug: "support-explorer",
    title: "Ticket Explorer",
    menuTitle: "Ticket Explorer",
    icon: "fas fa-search",
    capability: "zander.web.ticket",
    path: "/dashboard/support/explorer",
    featureFlag: "support",
    group: "Support",
    sortOrder: 51,
  },
  {
    slug: "support-categories",
    title: "Ticket Categories",
    menuTitle: "Categories",
    icon: "fas fa-folder",
    capability: "zander.web.ticket",
    path: "/dashboard/support/categories",
    featureFlag: "support",
    group: "Support",
    sortOrder: 52,
  },

  // ── Voting group ───────────────────────────────────────────────────────────
  {
    slug: "voting-sites",
    title: "Vote Sites",
    menuTitle: "Vote Sites",
    icon: "fa-solid fa-check-to-slot",
    capability: "zander.web.voting",
    path: "/dashboard/voting",
    featureFlag: "vote",
    group: "Voting",
    sortOrder: 60,
  },
  {
    slug: "voting-rewards",
    title: "Reward Templates",
    menuTitle: "Reward Templates",
    icon: "fa-solid fa-gift",
    capability: "zander.web.voting",
    path: "/dashboard/voting/rewards",
    featureFlag: "vote",
    group: "Voting",
    sortOrder: 61,
  },
  {
    slug: "voting-leaderboard",
    title: "Vote Leaderboard",
    menuTitle: "Leaderboard",
    icon: "fa-solid fa-trophy",
    capability: "zander.web.voting",
    path: "/dashboard/voting/leaderboard",
    featureFlag: "vote",
    group: "Voting",
    sortOrder: 62,
  },
  {
    slug: "voting-queue",
    title: "Reward Queue",
    menuTitle: "Reward Queue",
    icon: "fa-solid fa-list-check",
    capability: "zander.web.voting",
    path: "/dashboard/voting/queue",
    featureFlag: "vote",
    group: "Voting",
    sortOrder: 63,
  },

  // ── System group ───────────────────────────────────────────────────────────
  {
    slug: "vault",
    title: "Vault",
    menuTitle: "Vault",
    icon: "fa-solid fa-vault",
    capability: "zander.web.vault",
    path: "/dashboard/vault",
    featureFlag: "vault",
    group: "System",
    sortOrder: 70,
  },
  {
    slug: "logs",
    title: "System Logs",
    menuTitle: "Logs",
    icon: "fa-solid fa-terminal",
    capability: "zander.web.logs",
    path: "/dashboard/logs",
    group: "System",
    sortOrder: 71,
  },
  {
    slug: "bridge",
    title: "Bridge Processor",
    menuTitle: "Bridge",
    icon: "fa-solid fa-bridge",
    capability: "zander.web.bridge",
    path: "/dashboard/bridge",
    group: "System",
    sortOrder: 72,
  },
  {
    slug: "ranks",
    title: "Ranks",
    menuTitle: "Ranks",
    icon: "fa-solid fa-medal",
    capability: "zander.web.ranks",
    path: "/dashboard/ranks",
    featureFlag: "ranks",
    group: "System",
    sortOrder: 73,
  },
  {
    slug: "scheduler",
    title: "Message Scheduler",
    menuTitle: "Scheduler",
    icon: "fa-solid fa-clock",
    capability: "zander.web.scheduler",
    path: "/dashboard/scheduler",
    group: "System",
    sortOrder: 74,
  },

  // ── Finance group ──────────────────────────────────────────────────────────
  {
    slug: "finance",
    title: "Finance",
    menuTitle: "Overview",
    icon: "fa-solid fa-chart-line",
    capability: "zander.web.finance",
    path: "/dashboard/finance",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 80,
  },
  {
    slug: "finance-vendors",
    title: "Vendors",
    menuTitle: "Vendors",
    icon: "fa-solid fa-building",
    capability: "zander.web.finance",
    path: "/dashboard/finance/vendors",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 81,
  },
  {
    slug: "finance-invoices",
    title: "Invoices",
    menuTitle: "Invoices",
    icon: "fa-solid fa-file-invoice",
    capability: "zander.web.finance",
    path: "/dashboard/finance/invoices",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 82,
  },
  {
    slug: "finance-payments",
    title: "Payments",
    menuTitle: "Payments",
    icon: "fa-solid fa-money-check-dollar",
    capability: "zander.web.finance",
    path: "/dashboard/finance/payments",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 83,
  },
  {
    slug: "finance-transactions",
    title: "Transactions",
    menuTitle: "Transactions",
    icon: "fa-solid fa-right-left",
    capability: "zander.web.finance",
    path: "/dashboard/finance/transactions",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 84,
  },
  {
    slug: "finance-budget",
    title: "Budget",
    menuTitle: "Budget",
    icon: "fa-solid fa-chart-pie",
    capability: "zander.web.finance",
    path: "/dashboard/finance/budget",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 85,
  },
  {
    slug: "finance-reports",
    title: "Reports",
    menuTitle: "Reports",
    icon: "fa-solid fa-file-chart-column",
    capability: "zander.web.finance",
    path: "/dashboard/finance/reports",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 86,
  },
  {
    slug: "finance-settings",
    title: "Finance Settings",
    menuTitle: "Settings",
    icon: "fa-solid fa-gear",
    capability: "zander.web.finance.manage",
    path: "/dashboard/finance/settings",
    featureFlag: "finance",
    group: "Finance",
    sortOrder: 87,
  },

  // ── Community — Badges ─────────────────────────────────────────────────────
  {
    slug: "badges",
    title: "Badges",
    menuTitle: "Badges",
    icon: "fa-solid fa-award",
    capability: "zander.web.badges",
    path: "/dashboard/badges",
    group: "Community",
    sortOrder: 23,
  },
];

// ---------------------------------------------------------------------------
// Sub-pages (registered for breadcrumb / title lookup; not shown in sidebar)
// ---------------------------------------------------------------------------
export const adminSubPages = [
  {
    slug: "announcements-create",
    title: "Create Announcement",
    parent: "announcements",
    path: "/dashboard/announcements/create",
    capability: "zander.web.announcements",
  },
  {
    slug: "announcements-edit",
    title: "Edit Announcement",
    parent: "announcements",
    path: "/dashboard/announcements/edit",
    capability: "zander.web.announcements",
  },
  {
    slug: "servers-create",
    title: "Create Server",
    parent: "servers",
    path: "/dashboard/servers/create",
    capability: "zander.web.server",
  },
  {
    slug: "servers-edit",
    title: "Edit Server",
    parent: "servers",
    path: "/dashboard/servers/edit",
    capability: "zander.web.server",
  },
  {
    slug: "events-edit",
    title: "Edit Event",
    parent: "events-list",
    path: "/dashboard/events",
    capability: "zander.web.events",
  },
  {
    slug: "forms-create",
    title: "Create Form",
    parent: "forms",
    path: "/dashboard/forms/create",
    capability: "zander.web.forms",
  },
  {
    slug: "forms-edit",
    title: "Edit Form",
    parent: "forms",
    path: "/dashboard/forms/edit",
    capability: "zander.web.forms",
  },
  {
    slug: "badges-create",
    title: "Create Badge",
    parent: "badges",
    path: "/dashboard/badges/create",
    capability: "zander.web.badges",
  },
  {
    slug: "badges-edit",
    title: "Edit Badge",
    parent: "badges",
    path: "/dashboard/badges/edit",
    capability: "zander.web.badges",
  },
  {
    slug: "badges-assign",
    title: "Assign Badge",
    parent: "badges",
    path: "/dashboard/badges/assign",
    capability: "zander.web.badges",
  },

  // Finance sub-pages
  { slug: "finance-vendor-detail", title: "Vendor", parent: "finance-vendors", path: "/dashboard/finance/vendors/", capability: "zander.web.finance" },
  { slug: "finance-vendor-create", title: "Add Vendor", parent: "finance-vendors", path: "/dashboard/finance/vendors/create", capability: "zander.web.finance.manage" },
  { slug: "finance-invoice-detail", title: "Invoice", parent: "finance-invoices", path: "/dashboard/finance/invoices/", capability: "zander.web.finance" },
  { slug: "finance-invoice-create", title: "New Invoice", parent: "finance-invoices", path: "/dashboard/finance/invoices/create", capability: "zander.web.finance.manage" },
  { slug: "finance-payment-create", title: "Record Payment", parent: "finance-payments", path: "/dashboard/finance/payments/create", capability: "zander.web.finance.manage" },
  { slug: "finance-transaction-detail", title: "Transaction", parent: "finance-transactions", path: "/dashboard/finance/transactions/", capability: "zander.web.finance" },
  { slug: "finance-transaction-create", title: "New Transaction", parent: "finance-transactions", path: "/dashboard/finance/transactions/create", capability: "zander.web.finance.manage" },
  { slug: "finance-report-detail", title: "Report", parent: "finance-reports", path: "/dashboard/finance/reports/", capability: "zander.web.finance" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal permission check mirroring api/common.js hasSpecificPermission.
 * Kept here to avoid circular imports into the admin layer.
 */
function checkPermission(permissionsArray, node) {
  if (!node) return true;
  if (!Array.isArray(permissionsArray) || permissionsArray.length === 0)
    return false;
  const target = node.trim().toLowerCase();
  return permissionsArray.some((p) => {
    if (!p) return false;
    const c = String(p).trim().toLowerCase();
    if (c === "*") return true;
    if (c === target) return true;
    if (c.endsWith(".*")) return target.startsWith(c.slice(0, -1));
    return false;
  });
}

/**
 * Return all menu pages visible to the current user, sorted by sortOrder.
 *
 * @param {string[]} userPermissions  – req.session.user.permissions
 * @param {object}   features         – parsed features.json
 */
export function getMenuItems(userPermissions, features) {
  return adminPages
    .filter((page) => {
      if (page.hiddenFromMenu) return false;
      if (page.featureFlag && !features[page.featureFlag]) return false;
      if (page.capability && !checkPermission(userPermissions, page.capability))
        return false;
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Return menu items grouped by their `group` field, preserving insertion order.
 * Each entry is  { group: string|null, items: AdminPage[] }.
 *
 * @param {string[]} userPermissions
 * @param {object}   features
 */
export function getMenuGroups(userPermissions, features) {
  const items = getMenuItems(userPermissions, features);
  const groups = [];
  const seen = new Map();

  for (const item of items) {
    const key = item.group ?? "__toplevel__";
    if (!seen.has(key)) {
      const entry = { group: item.group, items: [] };
      seen.set(key, entry);
      groups.push(entry);
    }
    seen.get(key).items.push(item);
  }

  return groups;
}

/**
 * Find a registered page (or sub-page) by its URL path.
 * Used to derive breadcrumbs and determine the active menu item.
 *
 * @param {string} urlPath  – req.url (query-string is stripped internally)
 */
export function getPageByPath(urlPath) {
  const clean = urlPath.split("?")[0];
  return (
    adminPages.find((p) => p.path === clean) ??
    adminSubPages.find((p) => clean.startsWith(p.path))
  );
}
