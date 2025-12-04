# Crash reporting

This document explains how crash reporting works in the Zander web application and how to configure it for your deployment. The goal is to capture unexpected errors, forward them to your Discord workspace, and let users voluntarily submit additional context when they encounter a problem.

## Overview

Crash reporting is powered by the following pieces:

- **Fastify error handler**: Captures uncaught runtime errors thrown during route handling and forwards a crash report payload.
- **Public API endpoint**: `/api/crash-report` accepts user-submitted crash reports without authentication.
- **Error page form**: The UI on the error page lets a user add optional context and submits it to the crash-report endpoint.
- **Discord webhook**: Reports are sent to a Discord channel via the webhook configured in `config.json`.
- **Feature flag**: The `crashReports` flag in `features.json` toggles all crash reporting behaviour on or off.

## Configuration

1. **Enable crash reporting** by setting `"crashReports": true` in `features.json`.
2. **Provide a Discord webhook URL** under `discord.webhooks.crashReport` in `config.json` or `config.json.example`:

   ```json
   {
     "discord": {
       "webhooks": {
         "crashReport": "https://discord.com/api/webhooks/..."
       }
     }
   }
   ```

3. **Environment variables**: No additional environment variables are required beyond the existing server configuration. The server must still be able to read `PORT` and the session cookie secret.

If the webhook URL is missing or the feature flag is disabled, crash reports will be skipped gracefully and the API will return a feature-disabled message.

## Runtime crash handling

When Fastify encounters an error while processing a request, the global error handler (in `app.js`) will:

1. Resolve a status code based on the thrown error (default 500).
2. Attempt to send a crash report with context including the request method and URL, user session username (if any), status code, and error details.
3. Render the `views/session/error.ejs` page to the user while omitting stack traces from the response.

Crash reporting failures are logged but do not interrupt the request lifecycle.

## User-submitted crash reports

- The `/api/crash-report` endpoint accepts JSON payloads containing:
  - `summary` – freeform text entered by the user (optional).
  - `errorMessage` – error message shown by the server (optional).
  - `errorStack` – stack trace captured server-side (optional).
  - `statusCode` – numeric HTTP status code associated with the error (optional).
  - `pageUrl` – page URL where the error occurred (optional).
- No authentication is required; use this endpoint from public pages (e.g., the error page form).
- The endpoint respects the `crashReports` feature flag. When disabled, it responds with `success: false` and a feature-disabled message.

## Error page behaviour

When a page-level error occurs, the error page (`views/session/error.ejs`) renders:

- The error message (if provided).
- A “Send crash report” card containing a textarea and a submit button.
- Client-side logic to POST the form to `/api/crash-report` with page URL and server-provided error context.

Upon successful submission, the form displays a confirmation message and disables the textarea. Failures show an inline error message and re-enable the submit button.

## Discord payload format

Crash reports are dispatched via `controllers/crashReportController.js` using the `discord-webhook-node` library. Payloads are sent as a Discord embed with the following fields when available:

- Context label (`Context`) indicating the source (e.g., `fastify-errorHandler` or `user-submitted`).
- HTTP status code and request route.
- Logged-in username (if present in the session).
- Page URL and user agent.
- Error message and stack trace (truncated for safety).
- User-provided notes and any additional metadata.

Each field is truncated to reasonable lengths to avoid Discord payload limits.

## Operational tips

- **Testing locally**: Set the `crashReport` webhook to a personal Discord channel to validate formatting without impacting production channels.
- **Privacy**: Be mindful of the data contained in stack traces and user notes before forwarding them to shared channels.
- **Monitoring**: Failed webhook deliveries are logged to the server console with context to aid debugging.

## Troubleshooting

- **No reports arriving**: Confirm `features.json` has `"crashReports": true` and `config.json` contains a valid `discord.webhooks.crashReport` URL.
- **Webhook errors in logs**: Check network connectivity to Discord and verify the webhook URL has not been rotated or deleted.
- **API returns feature disabled**: Ensure your deployment uses the updated `features.json` with crash reporting enabled.

