# zander-web
The web component of the Zander project that contains database, API and website.

Documentation: [https://modularsoft.org/docs/products/zander](https://modularsoft.org/docs/products/zander)

## Permissions

All permission nodes follow dot-notation and are managed via LuckPerms. Wildcard support is available (e.g. `zander.web.*` grants all `zander.web.X` nodes). The special `*` node grants full access.

### Web Dashboard

| Permission Node | Description |
|---|---|
| `zander.web.dashboard` | Access the main dashboard |
| `zander.web.logs` | View system logs and audit trails |
| `zander.web.announcements` | Create, edit, and view announcements |
| `zander.web.announcement` | Internal API access for announcements |
| `zander.web.application` | Manage player applications |
| `zander.web.server` | Manage game servers |
| `zander.web.rank` | Manage player ranks |
| `zander.web.scheduler` | Schedule announcements/messages |
| `zander.web.vault` | Access vault management |
| `zander.web.bridge` | Manage bridge/integrations |
| `zander.web.punishment.view` | View the global punishments list |
| `zander.web.punishments` | View punishments on user profiles |
| `zander.web.audit` | Run audit commands in Discord |
| `zander.web.nicknamecheck` | Run nickname check commands |

### Support Tickets

| Permission Node | Description |
|---|---|
| `zander.web.tickets` | Access the support ticket dashboard |
| `zander.web.tickets.{slug}` | Access a specific ticket category (dynamic, based on category slug) |
| `zander.web.tickets.*` | Access all ticket categories |
| `zander.web.ticket.escalate` | Escalate support tickets |

### Forums

| Permission Node | Description |
|---|---|
| `zander.forums.moderate` | General forum moderation rights |
| `zander.forums.post.delete` | Delete forum posts |
| `zander.forums.viewArchived` | View archived forum discussions |
| `zander.forums.discussion.sticky` | Sticky forum discussions |
| `zander.forums.discussion.lock` | Lock forum discussions |
| `zander.forums.discussion.archive` | Archive forum discussions |
| `zander.forums.category.manage` | Manage forum categories (admin dashboard) |

### Discord Punishments

| Permission Node | Description |
|---|---|
| `zander.discord.punish.warn` | Issue warnings to users via Discord |
| `zander.discord.punish.kick` | Kick users from the Discord server |
| `zander.discord.punish.ban` | Ban/unban users from the Discord server |
| `zander.discord.punish.mute` | Mute/unmute users in Discord |
| `zander.discord.punish.history` | View punishment history for users |