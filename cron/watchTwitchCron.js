/**
 * Twitch live-stream sync cron.
 *
 * Runs every 5 minutes. For each eligible creator with an active Twitch connection:
 *   - Fetches current stream data from the Twitch Helix API (app access token)
 *   - Applies CFC content filters
 *   - Upserts eligible streams into creator_content_items
 *   - Marks streams that ended as offline
 *   - Sends a one-time Discord notification when a creator first goes live
 */

import cron from "node-cron";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");

import { EmbedBuilder, WebhookClient } from "discord.js";
import {
  getEligibleCreators,
  matchesCfcFilter,
  upsertContentItem,
  markStreamsOffline,
  updateSyncStatus,
  hasNotificationBeenSent,
  recordNotification,
} from "../controllers/watchController.js";

// ---------------------------------------------------------------------------
// Twitch App Access Token (Client Credentials)
// ---------------------------------------------------------------------------

let cachedAppToken = null;
let tokenExpiresAt = 0;

async function getTwitchAppToken(fetchFn) {
  if (cachedAppToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAppToken;
  }

  if (!process.env.twitchClientId || !process.env.twitchClientSecret) {
    return null;
  }

  try {
    const res = await fetchFn("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${encodeURIComponent(process.env.twitchClientId)}&client_secret=${encodeURIComponent(process.env.twitchClientSecret)}&grant_type=client_credentials`,
    });

    if (!res.ok) {
      console.error("[WatchTwitch] Failed to obtain app access token:", res.status);
      return null;
    }

    const data = await res.json();
    cachedAppToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return cachedAppToken;
  } catch (err) {
    console.error("[WatchTwitch] Error fetching app access token:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Discord notification helper
// ---------------------------------------------------------------------------

async function sendLiveNotification(item, watchSettings) {
  const webhookUrl = config?.watch?.contentChannelWebhook;
  if (!webhookUrl || !webhookUrl.startsWith("http")) return null;

  if (!watchSettings?.notify_discord_on_live) return null;

  try {
    const webhook = new WebhookClient({ url: webhookUrl });
    const embed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle(`${item.platform_display_name || item.username} is live on Twitch!`)
      .setDescription(item.title || "")
      .setURL(item.watch_url)
      .setTimestamp();

    if (item.thumbnail_url) embed.setImage(item.thumbnail_url);

    const pingRole = config?.watch?.contentPingRoleId;
    const content = pingRole ? `<@&${pingRole}>` : undefined;

    const msg = await webhook.send({ content, embeds: [embed] });
    return msg?.id || "sent";
  } catch (err) {
    console.error("[WatchTwitch] Discord notification failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

async function syncTwitchCreator(creator, appToken, fetchFn) {
  const broadcasterId = creator.platform_account_id;

  try {
    const streamRes = await fetchFn(
      `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`,
      {
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Client-Id": process.env.twitchClientId,
        },
      }
    );

    if (!streamRes.ok) {
      throw new Error(`Helix streams API returned ${streamRes.status}`);
    }

    const streamData = await streamRes.json();
    const stream = streamData?.data?.[0]; // null when offline

    if (!stream) {
      // Creator is offline — mark any tracked live entry as ended
      await markStreamsOffline("twitch", []);
      await updateSyncStatus(creator.user_id, "twitch", { success: true });
      return;
    }

    const tags = Array.isArray(stream.tags) ? stream.tags : [];
    const matchedRule = matchesCfcFilter(
      "twitch",
      { title: stream.title, description: "", tags },
      config
    );

    const isCfc = Boolean(matchedRule);
    const isPublic = isCfc;

    const thumbnailUrl = stream.thumbnail_url
      ? stream.thumbnail_url.replace("{width}", "640").replace("{height}", "360")
      : null;

    const contentItem = {
      user_id: creator.user_id,
      platform: "twitch",
      external_content_id: stream.id,
      external_channel_id: broadcasterId,
      content_type: "live_stream",
      title: stream.title,
      description: null,
      thumbnail_url: thumbnailUrl,
      watch_url: `https://www.twitch.tv/${creator.platform_username}`,
      tags_json: JSON.stringify(tags),
      is_live: 1,
      published_at: null,
      started_at: stream.started_at ? new Date(stream.started_at) : null,
      ended_at: null,
      matched_rule: matchedRule,
      is_cfc_related: isCfc ? 1 : 0,
      is_publicly_visible: isPublic ? 1 : 0,
    };

    await upsertContentItem(contentItem);

    // Send Discord live notification if not already sent
    if (isPublic) {
      const alreadySent = await hasNotificationBeenSent("twitch", stream.id, "live");
      if (!alreadySent) {
        const messageId = await sendLiveNotification(
          { ...contentItem, platform_display_name: creator.platform_display_name, username: creator.username },
          creator
        );
        await recordNotification("twitch", stream.id, "live", messageId);
      }
    }

    await updateSyncStatus(creator.user_id, "twitch", { success: true });
  } catch (err) {
    console.error(`[WatchTwitch] Sync failed for user ${creator.user_id}:`, err);
    await updateSyncStatus(creator.user_id, "twitch", { success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Cron schedule: every 5 minutes
// ---------------------------------------------------------------------------

let isTwitchSyncRunning = false;

const twitchSyncTask = cron.schedule("*/5 * * * *", async () => {
  if (!process.env.twitchClientId || !process.env.twitchClientSecret) return;
  if (isTwitchSyncRunning) return;

  isTwitchSyncRunning = true;
  try {
    const { default: fetch } = await import("node-fetch");
    const appToken = await getTwitchAppToken(fetch);
    if (!appToken) return;

    const creators = await getEligibleCreators("twitch");
    if (creators.length === 0) return;

    // Sync each creator
    const liveStreamIds = [];
    for (const creator of creators) {
      const broadcasterId = creator.platform_account_id;
      try {
        const streamRes = await fetch(
          `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`,
          {
            headers: {
              Authorization: `Bearer ${appToken}`,
              "Client-Id": process.env.twitchClientId,
            },
          }
        );

        if (!streamRes.ok) continue;
        const streamData = await streamRes.json();
        const stream = streamData?.data?.[0];
        if (stream) liveStreamIds.push(stream.id);

        await syncTwitchCreator(creator, appToken, fetch);
      } catch (err) {
        console.error(`[WatchTwitch] Error during creator sync (${creator.user_id}):`, err);
      }
    }

    // Mark any previously-live entries that are no longer live as ended
    await markStreamsOffline("twitch", liveStreamIds);
  } catch (err) {
    console.error("[WatchTwitch] Cron error:", err);
  } finally {
    isTwitchSyncRunning = false;
  }
});

twitchSyncTask.start();
