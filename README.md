# Zander Web

## Overview
Zander Web powers the public website, account portal, moderation APIs, and automation hooks that connect the Crafting for Christ network together. The application is built on [Fastify](https://fastify.dev/) for the HTTP layer, [EJS](https://ejs.co/) for server-rendered pages, and a MySQL database for persistence. A companion Discord bot (powered by [@sapphire/framework](https://github.com/sapphiredev/framework)) lives in the same codebase so web actions and in-game events can surface inside Discord via webhooks.

The platform exposes two major surfaces:

- **Session flows** – login, registration, password recovery, email verification, and account management for both email/password and Discord identities.
- **Dashboard tooling** – administrative screens for announcements, applications, bridges, logs, servers, the in-game vault, and moderation reports backed by internal API routes.

Additional background services include cron jobs, profanity filtering endpoints, and webhook bridges so Minecraft and Discord activity can be audited across systems.

## Key Capabilities
- Email + password authentication with configurable password policies and email verification.
- Discord OAuth sign-in and account linking plus Minecraft verification flows.
- Moderation tooling (reports API, profanity filter, audit trail updates).
- Responsive administrative dashboard composed of reusable header/nav/footer partials.
- Discord webhook publishers for chat logs, staff alerts, join/leave messages, and automated celebrations.
- SMTP2GO-backed transactional email delivery for registration, verification, and password reset templates.

## Project Layout
```
├── api/                  # REST-like endpoints consumed by the UI and Minecraft plugins
├── app.js                # Fastify bootstrapper and shared middleware
├── assets/               # Compiled CSS/JS served to the browser
├── commands/             # Discord slash commands (sapphire framework)
├── controllers/          # Database, email, Discord, and domain-specific controllers
├── cron/                 # Scheduled background tasks (node-cron)
├── migration/            # Versioned SQL migrations
├── routes/               # Web route handlers that render EJS templates
├── utils/                # Shared utilities (e.g., password policy)
├── views/                # EJS views, layout partials, and email templates
├── dbinit.sql            # Baseline database schema for a fresh environment
├── docs/                 # Project documentation (e.g., SMTP2GO guide)
└── package.json          # NPM metadata and scripts
```

## Prerequisites
- **Node.js** 18.18.x (matches the production runtime). Install via nvm, asdf, or your package manager.
- **npm** ≥ 8.5.
- **MySQL** 8.x (or MariaDB 10.5+) with permission to create databases, views, and triggers.
- **SMTP2GO** (or SMTP credentials that mirror its interface) for outbound email.
- **Discord bot & webhooks** – a bot token, OAuth credentials, and webhook URLs for the moderation/staff channels referenced in `config.json`.

## Environment Configuration
Create a `.env` file (or populate environment variables in your hosting provider) with at least the following values:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port exposed by Fastify. Default deployments (Render/Heroku) inject this value automatically. |
| `siteAddress` | Public base URL used when generating callbacks and verification/reset links. |
| `sessionCookieSecret` | Secret used to sign Fastify session cookies. |
| `apiKey` | Shared secret used when internal pages proxy API calls. |
| `databaseHost` / `databasePort` / `databaseUser` / `databasePassword` / `databaseName` | MySQL connection details consumed by the connection pool in `controllers/databaseController.js`. |
| `discordAPIKey` | Bot token used by the sapphire Discord client. |
| `discordClientId` / `discordClientSecret` | OAuth credentials for the Discord login flow. |
| `smtpHost` / `smtpPort` / `smtpUser` / `smtpPass` | SMTP transport settings. Defaults are tailored to SMTP2GO and can usually be left unset except for the credentials. |
| `smtpIdentityEmailAddress` | “From” address used in transactional email. Must be verified within SMTP2GO. |
| `smtpIdentityDisplayName` | Friendly display name for outbound email. Falls back to `siteName` if undefined. |
| `siteName` | Used in templated emails and UI messaging. |

Optional helpers:
- `siteLogoUrl`, `siteFaviconUrl`, or other branding environment variables if referenced in templates.
- Feature flags configured in `features.json` can be toggled without redeploying.

Duplicate `config.json.example` to `config.json` and tailor site metadata, Discord webhook endpoints, and password policy defaults. The JSON file is loaded at runtime and complements environment variables.

## Database Setup
1. Create the schema using `dbinit.sql` or run the latest migration in `migration/` against an empty database.
2. Configure your MySQL credentials in the environment.
3. For production upgrades, apply versioned migrations sequentially (e.g., `mysql -u user -p database < migration/v1.2.0_v1.3.0.sql`).

The schema relies on external databases (`cfcdev_luckperms`, `cfcdev_litebans`, etc.) for views. Mirror those data sources locally or adjust the views for your environment.

## Installing Dependencies
```bash
npm install
```

## Running the Application
- **Development**: `npm run dev` launches Fastify with `nodemon` so changes reload automatically.
- **Production**: `npm run prod` mirrors the Render/Heroku command with the required Node.js flags enabled.

Logs surface directly in the console. Discord- and SMTP-related warnings are written alongside standard HTTP request logs.

## Testing & Tooling
The project currently does not include automated tests. Before opening a pull request, manually verify:
- Session flows (register, login, forgot/reset password, email verification).
- Dashboard actions (create/update announcements, applications, servers, vault records).
- Discord webhook delivery for moderation events.
- SMTP delivery in a staging environment (see [`docs/smtp2go.md`](docs/smtp2go.md)).

## Background Jobs & Services
- `cron/cakeDayUserCheck.js` – daily job that congratulates long-term members via Discord.
- Listeners under `listeners/` react to Discord events (message edits/deletes, member verification, boosts) and post structured embeds via webhooks.
- `api/routes/filter.js` – profanity/link filtering endpoint consumed by the in-game chat bridge.

## Documentation
Additional operational guides live in the [`docs/`](docs/) directory:
- [`SMTP2GO configuration`](docs/smtp2go.md) – provisioning steps, environment variable mapping, and testing tips for transactional email.

Historic external documentation previously referenced in the README is preserved at [https://modularsoft.org/docs/products/zander](https://modularsoft.org/docs/products/zander).
