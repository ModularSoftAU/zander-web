# Admin Screen Inventory

All admin screens accessible under `/dashboard`.  
Status key: **Rewritten** = new WP-style layout + content | **Bridged** = new layout shell, original inner content | **Unchanged** = not yet migrated

---

## Top-level screens

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Dashboard Home | `/dashboard` | `zander.web.dashboard` | — | **Rewritten** |
| System Logs | `/dashboard/logs` | `zander.web.logs` | — | **Bridged** |
| Bridge Processor | `/dashboard/bridge` | `zander.web.bridge` | — | **Bridged** |

---

## Announcements

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Announcements List | `/dashboard/announcements` | `zander.web.announcements` | `announcements` | **Rewritten** |
| Create Announcement | `/dashboard/announcements/create` | `zander.web.announcements` | `announcements` | **Bridged** |
| Edit Announcement | `/dashboard/announcements/edit?announcementId=N` | `zander.web.announcements` | `announcements` | **Bridged** |

---

## Applications

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Applications List | `/dashboard/applications` | `zander.web.application` | `applications` | **Bridged** |
| View Application | `/dashboard/applications?applicationId=N` | `zander.web.application` | `applications` | **Bridged** |

---

## Servers

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Server List | `/dashboard/servers` | `zander.web.server` | `server` | **Rewritten** |
| Create Server | `/dashboard/servers/create` | `zander.web.server` | `server` | **Bridged** |
| Edit Server | `/dashboard/servers/edit?id=N` | `zander.web.server` | `server` | **Bridged** |

---

## Events

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Events Calendar | `/dashboard/events` | `zander.web.events` | `events` | **Bridged** |
| All Events | `/dashboard/events/list` | `zander.web.events` | `events` | **Bridged** |
| Review Queue | `/dashboard/events/review` | `zander.web.events` | `events` | **Bridged** |
| Event Templates | `/dashboard/events/templates` | `zander.web.events` | `events` | **Bridged** |
| Template Editor | `/dashboard/events/templates/edit?id=N` | `zander.web.events` | `events` | **Bridged** |
| Event Editor | `/dashboard/events/edit?eventId=N` | `zander.web.events` | `events` | **Bridged** |
| Event Detail | `/dashboard/events/:eventId` | `zander.web.events` | `events` | **Bridged** |

---

## Forums

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Forum Categories | `/dashboard/forums/categories` | `zander.web.forums` | `forums` | **Bridged** |

---

## Moderation

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Web Punishments | `/dashboard/web-punishments` | `zander.web.web-punishments` | — | **Bridged** |

---

## Support

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Manage Tickets | `/dashboard/support` | `zander.web.ticket` | `support` | **Bridged** |
| Ticket Explorer | `/dashboard/support/explorer` | `zander.web.ticket` | `support` | **Bridged** |
| Ticket Categories | `/dashboard/support/categories` | `zander.web.ticket` | `support` | **Bridged** |
| Edit Category | `/dashboard/support/categories/edit?id=N` | `zander.web.ticket` | `support` | **Bridged** |

---

## Voting

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Vote Sites | `/dashboard/voting` | `zander.web.voting` | `vote` | **Bridged** |
| Reward Templates | `/dashboard/voting/rewards` | `zander.web.voting` | `vote` | **Bridged** |
| Leaderboard | `/dashboard/voting/leaderboard` | `zander.web.voting` | `vote` | **Bridged** |
| Reward Queue | `/dashboard/voting/queue` | `zander.web.voting` | `vote` | **Bridged** |

---

## System

| Screen | Path | Permission node | Feature flag | Status |
|---|---|---|---|---|
| Vault | `/dashboard/vault` | `zander.web.vault` | `vault` | **Bridged** |
| Ranks | `/dashboard/ranks` | `zander.web.ranks` | `ranks` | **Bridged** |
| Message Scheduler | `/dashboard/scheduler` | `zander.web.scheduler` | — | **Bridged** |

---

## Admin UI Primitives

These reusable CSS classes are available to all admin pages via `admin.css`.

| Primitive | CSS class(es) | Used in |
|---|---|---|
| Page shell | `body.wp-admin`, `#wpcontent`, `#wpbody-content`, `.wrap` | All admin pages |
| Top bar | `#wpadminbar`, `.ab-item`, `.ab-left`, `.ab-right` | `_topbar.ejs` |
| Sidebar | `#adminmenuback`, `#adminmenu`, `.wp-menu-item`, `.wp-menu-heading` | `_sidebar.ejs` |
| Stat cards | `.stat-card-grid`, `.stat-card`, `.stat-icon`, `.stat-info` | Dashboard home |
| Widget grid | `.wp-widget-grid`, `.wp-card`, `.wp-card-header`, `.wp-card-body` | Dashboard home |
| Quick actions | `.quick-action-grid`, `.quick-action-item` | Dashboard home |
| List table | `.wp-list-wrap`, `.wp-list-table`, `.tablenav`, `.row-actions`, `.row-action-btn` | Announcements list, Servers list |
| Recent list | `.wp-recent-list` | Dashboard home widgets |
| Notices | `.wp-notice`, `.wp-notice-success/warning/error/info` | `_notices.ejs` |
| Status badges | `.wp-badge`, `.wp-badge.active/inactive/pending/error/info` | Announcements list, Servers list |
| Buttons | `.button-primary`, `.button`, `.button-danger`, `.page-title-action` | All converted screens |
| Empty state | `.wp-empty-state` | List screens |
| Form section | `.wp-form-section`, `.wp-form-table`, `.wp-field-hint` | Edit screens |
| Mobile drawer | CSS transitions on `#adminmenuback`, `#wp-admin-overlay`, JS in `_sidebar.ejs` | All admin pages |

---

## Permission Hierarchy Reference

All permission nodes below are LuckPerms nodes. The admin checks:
- Exact match: `zander.web.dashboard`
- Wildcard prefix: `zander.web.*` (matches all `zander.web.*`)
- Super-admin: `*`

| Node | Grants access to |
|---|---|
| `zander.web.dashboard` | Dashboard home |
| `zander.web.logs` | System logs |
| `zander.web.bridge` | Bridge processor |
| `zander.web.announcements` | Announcement management |
| `zander.web.application` | Applications management |
| `zander.web.server` | Server management |
| `zander.web.events` | Events calendar + management |
| `zander.web.forums` | Forum category management |
| `zander.web.web-punishments` | Web punishments |
| `zander.web.ticket` | Support ticket management |
| `zander.web.voting` | Voting site + reward management |
| `zander.web.vault` | Vault management |
| `zander.web.ranks` | Rank management |
| `zander.web.scheduler` | Message scheduler |
