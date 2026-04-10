# Admin Dashboard Architecture

## Overview

This document describes the redesigned admin dashboard for Zander Web — a WordPress-admin-inspired administration panel built on top of the existing Fastify + EJS + Prisma stack.

---

## Old Architecture — Issues Found

### 1. Self-fetching HTTP pattern
Dashboard route handlers fetched data from the *same running server* over HTTP:

```js
// Old pattern (routes/dashboard/announcement.js)
const apiData = await fetch(`${process.env.siteAddress}/api/announcement/get`, {
  headers: { "x-access-token": process.env.apiKey },
});
```

This added network round-trip latency, required the API server to be reachable from itself, and coupled dashboard pages to the external API contract even when no cross-process boundary existed.

### 2. Hardcoded sidebar in two places
`views/modules/dashboard/dashboard-sidebar.ejs` contained a full duplicate of the menu for desktop and for the mobile off-canvas drawer.  Adding a menu item required editing the same list in two places, and active-state detection used ad-hoc `currentPath.includes(...)` strings that were easy to get wrong.

### 3. No page registry
There was no central inventory of which admin pages existed, what permission each required, or how they were grouped.  Menu visibility logic was scattered across the sidebar template.

### 4. Layout coupling to the public site
Every dashboard page began with the public navigation bar (`navigationBar.ejs`) and a decorative hero image (`miniHeader.ejs`).  This loaded public-site CSS, jQuery, Summernote, DataTables, and the full footer with social links — none of which belong in an admin panel.

### 5. Mixed data-access patterns
Controllers mixed Prisma queries and mysql2 callback-style queries in the same function.  Dashboard routes called API endpoints, which called controllers, which queried the DB — three layers deep for a simple read.

### 6. Alert/notice handling via cookies
Cookie-based flash messages (`req.cookies.alertType` / `req.cookies.alertContent`) were read in dozens of separate `<% if (req.cookies.alertType) { %>` blocks in every template — easy to forget, easy to get wrong.

---

## New Architecture

### File Structure

```
zander-web/
├── admin/
│   ├── pageRegistry.js        ← Central registry of all admin pages
│   ├── adminHelpers.js        ← View-data helper used by route handlers
│   ├── migrate-views.mjs      ← One-shot migration script (run once)
│   ├── fix-footers.mjs        ← Second-pass footer fix script (run once)
│   └── migrate-support-views.mjs  ← Support-view migration script (run once)
│
├── assets/css/
│   ├── style.css              ← Public site styles (unchanged)
│   └── admin.css              ← NEW: WordPress-inspired admin skin
│
├── views/admin/               ← NEW: Admin layout partials
│   ├── _head.ejs              ← HTML <head>, Bootstrap, Font Awesome, admin.css
│   ├── _topbar.ejs            ← Fixed dark top bar with user info
│   ├── _sidebar.ejs           ← Sidebar generated from req.adminMenuGroups
│   ├── _notices.ejs           ← Flash messages (cookie + explicit)
│   └── _footer.ejs            ← Minimal admin footer + Bootstrap JS
│
├── routes/dashboard/
│   ├── index.js               ← UPDATED: adds preHandler hook for adminMenuGroups
│   ├── dashboard.js           ← REFACTORED: Prisma queries, no self-HTTP
│   ├── announcement.js        ← REFACTORED: Prisma queries, no self-HTTP
│   ├── servers.js             ← REFACTORED: Prisma queries, no self-HTTP
│   └── support.js             ← UPDATED: +adminViewData() spread
│
└── views/dashboard/           ← ALL views converted to new admin layout
    ├── dashboard-index.ejs    ← REWRITTEN: WP-style home with widgets
    ├── announcements/
    │   ├── announcements-list.ejs    ← REWRITTEN: WP list-table
    │   └── announcements-editor.ejs ← BRIDGED
    ├── servers/
    │   ├── server-list.ejs    ← REWRITTEN: WP list-table
    │   └── server-editor.ejs  ← BRIDGED
    └── [all other modules]    ← BRIDGED (new layout, existing content)
```

### Page Registry (`admin/pageRegistry.js`)

The registry is the **single source of truth** for the admin menu.  Every admin screen has an entry:

```js
{
  slug: "announcements",
  title: "Announcements",
  menuTitle: "Announcements",
  icon: "fas fa-bullhorn",
  capability: "zander.web.announcements",
  path: "/dashboard/announcements",
  featureFlag: "announcements",
  group: null,         // top-level item; string value = section heading
  sortOrder: 10,
}
```

`getMenuGroups(userPermissions, features)` filters the registry by:
- User permissions (LuckPerms node check, with `*` and `.*` wildcard support)
- Feature flags from `features.json`
- `hiddenFromMenu` flag

The result is attached to every `/dashboard/*` request via a `preHandler` hook in `routes/dashboard/index.js`:

```js
app.addHook("preHandler", async (req) => {
  if (req.url?.startsWith("/dashboard")) {
    req.adminMenuGroups = getMenuGroups(req.session?.user?.permissions ?? [], features);
  }
});
```

The `_sidebar.ejs` template reads `req.adminMenuGroups` (or `adminMenuGroups` if explicitly passed) and renders the menu.  **There is no longer any hardcoded menu list anywhere.**

### Admin Layout Shell

Each dashboard view now uses exactly five includes:

```ejs
<%- include("*/admin/_head.ejs",    { pageTitle }) %>   ← <head>, CSS
<%- include("*/admin/_topbar.ejs")               %>   ← fixed dark bar
<%- include("*/admin/_sidebar.ejs")              %>   ← generated sidebar

<div id="wpcontent">
  <div id="wpbody-content">
    <div class="wrap">
      <!-- page-specific content -->
    </div>
  </div>
  <%- include("*/admin/_footer.ejs") %>
</div>
```

This replaces the old six-include chain (header + navigationBar + miniHeader + dashboard-header + sidebar-in-grid + footer) and removes the public-site Bootstrap/jQuery/Summernote/DataTables load from admin pages.

### Data Access

| Route module | Before | After |
|---|---|---|
| `dashboard.js` | 5 internal HTTP fetches | Prisma: `count()` + `findMany()` |
| `announcement.js` | 1–2 internal HTTP fetches | Prisma: `findMany()` / `findUnique()` |
| `servers.js` | 1–2 internal HTTP fetches | Prisma: `findMany()` / `findUnique()` |
| `support.js` | already direct controller | unchanged + `adminViewData` spread |
| all others | internal HTTP fetches | **unchanged** (bridged, not yet refactored) |

Routes that haven't been refactored yet still use `fetch()` internally but now go through the new layout.  They are listed in the [technical debt](#remaining-technical-debt) section below.

### Permission Flow

```
Request → preHandler hook
         → getMenuGroups(userPermissions, features)
            → filters adminPages[] by capability + featureFlag
            → attaches result to req.adminMenuGroups
→ Route handler
   → hasPermission(node, req, res, features)  ← unchanged gate logic
   → render view with { req, ...adminViewData(req, features), ... }
→ _sidebar.ejs
   → reads req.adminMenuGroups
   → renders only items the user can access
```

---

## Migration Notes

### Views
All 30 dashboard views were migrated in three passes:

1. **`admin/migrate-views.mjs`** — main pass: replaced header/footer/sidebar includes, removed Bootstrap grid wrapper
2. **`admin/fix-footers.mjs`** — second pass: fixed files where modal/script content appeared between `</main>` and the footer include
3. **`admin/migrate-support-views.mjs`** — depth-3 support views in `views/modules/dashboard/support/`

The migration scripts are kept in the repo for reference but are not needed after migration.

### CSS
`admin.css` is completely standalone and scoped to `body.wp-admin`.  It does **not** affect the public site.  The existing `style.css` and `dashboard-style.css` are still loaded on public pages.

### EJS variable changes

| Old variable | New variable | Notes |
|---|---|---|
| `globalImage` | removed from admin pages | Not used in new layout |
| `announcementWeb` | kept | Passed through but `_topbar.ejs` doesn't render it |
| *(none)* | `adminMenuGroups` | Added via hook or `adminViewData()` |
| *(none)* | `adminCurrentPath` | Added via `adminViewData()` |

---

## Remaining Technical Debt

### Routes not yet migrated to direct Prisma queries

The following dashboard routes still use internal HTTP fetches.  They function correctly but should be migrated to direct Prisma/controller calls in a follow-up:

- `routes/dashboard/applications.js`
- `routes/dashboard/vault.js`
- `routes/dashboard/ranks.js`
- `routes/dashboard/forums.js`
- `routes/dashboard/scheduler.js`
- `routes/dashboard/webPunishments.js`
- `routes/dashboard/voting.js`
- `routes/dashboard/events.js`
- `routes/dashboard/dashboard.js` — `/dashboard/logs` and `/dashboard/bridge` still fetch internally (the underlying data uses cross-database raw queries not yet wrapped in Prisma)

### Legacy `dashboard-style.css`

The file `assets/css/dashboard-style.css` is still loaded by the old `header.ejs` but is no longer referenced by admin pages (which load `admin.css` instead).  It can be removed once all non-dashboard references are confirmed clean.

### Support view layout

The support views in `views/modules/dashboard/support/` were bridged (header/footer swapped) but their inner content structure still uses Bootstrap grid/card components from the old design.  A full visual conversion to `wp-card` / `wp-list-table` primitives is pending.

### Events module

The events module is large (7 view files, complex editor with calendar).  The views were bridged to the new layout but the inner content was not converted to WP-style table/card primitives.

### Mobile — minor gaps

The `quick-action-grid` and `stat-card-grid` components handle narrow screens well.  The events calendar (`events-calendar.ejs`) uses a third-party calendar library whose mobile styles are not overridden by `admin.css` — may need attention.

### No automated tests

No unit or integration tests exist for the admin layer.  The registry helper functions (`getMenuGroups`, `checkPermission`) are pure and straightforward to unit-test.
