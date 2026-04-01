/**
 * Event Discord Service
 * Handles creating, updating, and syncing Discord messages and Guild Scheduled Events.
 */

import { client } from "../controllers/discordController.js";
import { EmbedBuilder, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import { updateSyncStatus, logEventAudit } from "./eventService.js";

/**
 * Build an embed for an event announcement/publication.
 */
function buildEventEmbed(event) {
  const startTimestamp = Math.floor(new Date(event.startAt).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(event.endAt).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setTitle(event.title)
    .setColor(0x2f508c)
    .addFields(
      { name: "Starts", value: `<t:${startTimestamp}:F> (<t:${startTimestamp}:R>)`, inline: false },
      { name: "Ends", value: `<t:${endTimestamp}:F>`, inline: false }
    );

  if (event.description) {
    embed.setDescription(event.description.slice(0, 2048));
  }

  if (event.locationLabel) {
    embed.addFields({ name: "Location", value: event.locationLabel, inline: true });
  }

  if (event.serverName) {
    const serverValue = event.serverIp ? `${event.serverName}\n\`${event.serverIp}\`` : event.serverName;
    embed.addFields({ name: "Server", value: serverValue, inline: true });
  }

  if (event.bannerUrl) {
    embed.setImage(event.bannerUrl);
  }

  if (event.logoUrl) {
    embed.setThumbnail(event.logoUrl);
  }

  embed.setFooter({ text: `Event ID: ${event.eventId}` });
  embed.setTimestamp();

  return embed;
}

/**
 * Post a Discord announcement message on publish.
 * Returns the message ID.
 */
export async function postEventDiscordMessage(event, channelId) {
  if (!client?.isReady?.()) throw new Error("Discord client not ready");
  if (!channelId) throw new Error("No channel ID provided");

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased?.()) {
    throw new Error(`Channel ${channelId} is not text-based`);
  }

  const embed = buildEventEmbed(event);
  const msg = await channel.send({ embeds: [embed] });

  await updateSyncStatus(event.eventId, "discord", "ok", null, {
    discordMessageId: msg.id,
    discordChannelId: channelId,
  });

  await logEventAudit(
    event.eventId,
    null,
    "System",
    "discord_message_posted",
    `Discord message ${msg.id} posted to channel ${channelId}`
  );

  return msg.id;
}

/**
 * Edit an existing Discord event announcement message.
 */
export async function editEventDiscordMessage(event, channelId, messageId) {
  if (!client?.isReady?.()) throw new Error("Discord client not ready");
  if (!channelId || !messageId) throw new Error("channelId and messageId required");

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased?.()) {
    throw new Error(`Channel ${channelId} is not text-based`);
  }

  const msg = await channel.messages.fetch(messageId);
  const embed = buildEventEmbed(event);
  await msg.edit({ embeds: [embed] });

  await logEventAudit(
    event.eventId,
    null,
    "System",
    "discord_message_updated",
    `Discord message ${messageId} updated in channel ${channelId}`
  );

  return messageId;
}

/**
 * Create a Discord Guild Scheduled Event.
 * Returns the guild event ID.
 */
export async function createGuildScheduledEvent(event, guildId) {
  if (!client?.isReady?.()) throw new Error("Discord client not ready");
  if (!guildId) throw new Error("No guild ID provided");

  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error(`Guild ${guildId} not found`);

  const eventData = {
    name: event.title,
    scheduledStartTime: new Date(event.startAt),
    scheduledEndTime: new Date(event.endAt),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    description: event.description ? event.description.slice(0, 1000) : undefined,
    entityMetadata: {
      location: event.locationLabel || event.serverIp || "Online",
    },
  };

  if (event.bannerUrl) {
    try {
      eventData.image = event.bannerUrl;
    } catch {
      // Banner URL may not be a supported format; continue without it
    }
  }

  const guildEvent = await guild.scheduledEvents.create(eventData);

  await updateSyncStatus(event.eventId, "discord", "ok", null, {
    discordGuildEventId: guildEvent.id,
  });

  await logEventAudit(
    event.eventId,
    null,
    "System",
    "discord_guild_event_created",
    `Discord guild event ${guildEvent.id} created in guild ${guildId}`
  );

  return guildEvent.id;
}

/**
 * Edit an existing Discord Guild Scheduled Event.
 */
export async function editGuildScheduledEvent(event, guildId, guildEventId) {
  if (!client?.isReady?.()) throw new Error("Discord client not ready");
  if (!guildId || !guildEventId) throw new Error("guildId and guildEventId required");

  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error(`Guild ${guildId} not found`);

  const guildEvent = await guild.scheduledEvents.fetch(guildEventId);
  if (!guildEvent) throw new Error(`Guild event ${guildEventId} not found`);

  await guildEvent.edit({
    name: event.title,
    scheduledStartTime: new Date(event.startAt),
    scheduledEndTime: new Date(event.endAt),
    description: event.description ? event.description.slice(0, 1000) : undefined,
    entityMetadata: {
      location: event.locationLabel || event.serverIp || "Online",
    },
  });

  await logEventAudit(
    event.eventId,
    null,
    "System",
    "discord_guild_event_updated",
    `Discord guild event ${guildEventId} updated`
  );

  return guildEventId;
}

/**
 * Cancel a Discord Guild Scheduled Event.
 */
export async function cancelGuildScheduledEvent(event, guildId, guildEventId) {
  if (!client?.isReady?.()) return;
  if (!guildId || !guildEventId) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return;

    const guildEvent = await guild.scheduledEvents.fetch(guildEventId).catch(() => null);
    if (!guildEvent) return;

    await guildEvent.delete();

    await logEventAudit(
      event.eventId,
      null,
      "System",
      "discord_guild_event_cancelled",
      `Discord guild event ${guildEventId} cancelled`
    );
  } catch (error) {
    console.error("[EventDiscord] Failed to cancel guild event:", error.message);
  }
}

/**
 * Run all enabled Discord actions for an event on a given trigger.
 * config should include: { channelId, guildId, createGuildEvent }
 */
export async function runDiscordActionsForEvent(event, trigger, discordConfig = {}) {
  const actions = (event.actions || []).filter((a) => a.enabled && a.trigger === trigger);

  for (const action of actions) {
    const cfg = action.config || {};
    const channelId = cfg.channelId || discordConfig.channelId;
    const guildId = cfg.guildId || discordConfig.guildId;

    try {
      if (action.actionType === "discord_message") {
        if (trigger === "on_publish") {
          await postEventDiscordMessage(event, channelId);
        } else if (trigger === "on_update" && event.discordMessageId && event.discordChannelId) {
          await editEventDiscordMessage(event, event.discordChannelId, event.discordMessageId);
        }
      }

      if (action.actionType === "discord_guild_event") {
        if (trigger === "on_publish") {
          await createGuildScheduledEvent(event, guildId);
        } else if (trigger === "on_update" && event.discordGuildEventId) {
          await editGuildScheduledEvent(event, guildId, event.discordGuildEventId);
        } else if (trigger === "on_cancel" && event.discordGuildEventId) {
          await cancelGuildScheduledEvent(event, guildId, event.discordGuildEventId);
        }
      }

      // Mark action as run
      await updateActionRunStatus(action.id, "ok", null);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[EventDiscord] Action ${action.id} (${action.actionType}) failed:`, errMsg);
      await updateActionRunStatus(action.id, "failed", errMsg);

      await updateSyncStatus(event.eventId, "discord", "failed", errMsg);
    }
  }
}

async function updateActionRunStatus(actionId, status, error) {
  const { prisma } = await import("../controllers/databaseController.js");
  await prisma.event_actions.update({
    where: { id: actionId },
    data: { lastRunAt: new Date(), lastRunStatus: status, lastRunError: error || null },
  });
}
