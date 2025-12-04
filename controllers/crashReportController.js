import { Colors } from "discord.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { sendWebhookMessage } from "../lib/discord/webhooks.mjs";

const DEFAULT_MAX_LENGTH = 900;

function truncate(value, maxLength = DEFAULT_MAX_LENGTH) {
  if (!value) return null;

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);

  if (stringValue.length <= maxLength) {
    return stringValue;
  }

  return `${stringValue.slice(0, maxLength - 3)}...`;
}

function getUserAgent(request, providedUserAgent) {
  if (providedUserAgent) {
    return providedUserAgent;
  }

  if (!request?.headers) {
    return null;
  }

  return request.headers["user-agent"] ?? null;
}

export async function sendCrashReport({
  config,
  context = "unspecified",
  error,
  errorMessage = null,
  errorStack = null,
  request = null,
  statusCode = null,
  pageUrl = null,
  userNote = null,
  userAgent = null,
  metadata = {},
}) {
  const crashWebhook = config?.discord?.webhooks?.crashReport;

  if (!crashWebhook) {
    return false;
  }

  const requestLabel = request?.method || request?.url
    ? `${request.method ?? ""} ${request.url ?? ""}`.trim()
    : null;

  const embed = new MessageBuilder()
    .setTitle("Crash Report")
    .addField("Context", truncate(context) ?? "unspecified", true)
    .setColor(Colors.DarkRed)
    .setTimestamp();

  if (statusCode) {
    embed.addField("Status Code", `${statusCode}`, true);
  }

  if (requestLabel) {
    embed.addField("Route", requestLabel, true);
  }

  const username = request?.session?.user?.username;
  if (username) {
    embed.addField("User", username, true);
  }

  if (pageUrl) {
    embed.addField("Page URL", truncate(pageUrl, 1024));
  }

  const resolvedUserAgent = getUserAgent(request, userAgent);
  if (resolvedUserAgent) {
    embed.addField("User Agent", truncate(resolvedUserAgent, 1024));
  }

  const resolvedErrorMessage = errorMessage ?? error?.message;
  if (resolvedErrorMessage) {
    embed.addField("Error Message", truncate(resolvedErrorMessage, 1024));
  }

  const resolvedErrorStack = errorStack ?? error?.stack;
  if (resolvedErrorStack) {
    embed.addField(
      "Stack",
      `\`\`\`${truncate(resolvedErrorStack, 900)}\`\`\``
    );
  }

  if (userNote) {
    embed.addField("User Notes", truncate(userNote, 1024));
  }

  if (metadata && Object.keys(metadata).length > 0) {
    embed.addField(
      "Metadata",
      truncate(JSON.stringify(metadata, null, 2), 1024)
    );
  }

  const webhook = new Webhook(crashWebhook);

  return sendWebhookMessage(webhook, embed, {
    context: `crashReporter:${context}`,
  });
}
