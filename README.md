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

### Watch / Creator Content

| Permission Node | Description |
|---|---|
| `zander.watch.creator` | Marks the user as an eligible creator — their linked Twitch/YouTube content is synced to the `/watch` page |

---

## Creator Content Integration (Twitch & YouTube)

The `/watch` page displays live streams and recent videos from community members who have linked their Twitch or YouTube accounts and hold the `zander.watch.creator` permission node. Content is only surfaced if it contains a CFC marker (e.g. `#cfc` in a stream title/tag or video tag/description).

### How it works

1. A user connects their Twitch and/or YouTube account via **Profile → Connected Accounts**.
2. A server admin grants the user the `zander.watch.creator` LuckPerms node.
3. The cron jobs sync the creator's content every 5 minutes (Twitch) or 15 minutes (YouTube).
4. Matching content is cached in the database and shown on `/watch`.
5. A one-time Discord notification is posted to the configured webhook when a creator goes live or uploads an eligible video.

### Setting up Twitch OAuth

1. Go to [https://dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) and create a new application.
2. Set the **OAuth Redirect URL** to `https://<your-domain>/profile/social/twitch/callback`.
3. Copy the **Client ID** and generate a **Client Secret**.
4. Add the following to your `.env`:

```env
twitchClientId=YOUR_CLIENT_ID
twitchClientSecret=YOUR_CLIENT_SECRET
```

### Setting up YouTube OAuth & API Key

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com) and create (or select) a project.
2. Enable the **YouTube Data API v3** under *APIs & Services → Library*.
3. Create an **OAuth 2.0 Client ID** (*APIs & Services → Credentials → Create Credentials*):
   - Application type: **Web application**
   - Authorised redirect URI: `https://<your-domain>/profile/social/youtube/callback`
4. Create an **API Key** (*Create Credentials → API Key*) and restrict it to the YouTube Data API v3.
5. Add the following to your `.env`:

```env
googleClientId=YOUR_OAUTH_CLIENT_ID
googleClientSecret=YOUR_OAUTH_CLIENT_SECRET
youtubeApiKey=YOUR_API_KEY
```

### Configuring CFC content filters

The filters that determine whether content is CFC-related are configured in `config.json` under the `watch.filters` key:

```json
"watch": {
  "contentChannelWebhook": "https://discord.com/api/webhooks/...",
  "contentPingRoleId": null,
  "filters": {
    "twitch": {
      "titleMarkers": ["#cfc", "[cfc]"],
      "tags": ["cfc"]
    },
    "youtube": {
      "tags": ["cfc"],
      "descriptionMarkers": ["#cfc"]
    }
  }
}
```

| Field | Description |
|---|---|
| `contentChannelWebhook` | Discord webhook URL to post live/upload notifications to |
| `contentPingRoleId` | Role ID to ping in notifications, or `null` to disable pinging |
| `filters.twitch.titleMarkers` | Stream title substrings that qualify content (case-insensitive) |
| `filters.twitch.tags` | Twitch stream tags that qualify content (exact match, case-insensitive) |
| `filters.youtube.tags` | YouTube video tags that qualify content (exact match, case-insensitive) |
| `filters.youtube.descriptionMarkers` | Video description substrings that qualify content (case-insensitive) |

### Feature flag

The `/watch` route is controlled by the `watch` key in `features.json`. Set it to `false` to disable the page entirely:

```json
{
  "watch": false
}
```

### Database migration

Run `migration/v1.11.0_v1.12.0.sql` against your database to create the four tables required by this feature:

| Table | Purpose |
|---|---|
| `user_platform_connections` | Stores OAuth tokens and channel identity for each linked Twitch/YouTube account |
| `creator_watch_settings` | Per-user toggles controlling listing visibility and Discord notification preferences |
| `creator_content_items` | Cached CFC-eligible content items fetched by the cron jobs |
| `creator_content_notifications` | Deduplication log preventing repeat Discord notifications for the same content |

