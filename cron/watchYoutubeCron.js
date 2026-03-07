/**
 * YouTube content sync cron.
 *
 * Runs every 15 minutes. For each eligible creator with an active YouTube connection:
 *   - Fetches recent videos and live streams from the YouTube Data API v3
 *   - Applies CFC content filters (tags and description markers)
 *   - Upserts eligible items into creator_content_items
 *   - Marks live streams that have ended
 *   - Sends one-time Discord notifications for new eligible uploads and live streams
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
  updateSyncStatus,
  hasNotificationBeenSent,
  recordNotification,
} from "../controllers/watchController.js";

// ---------------------------------------------------------------------------
// Discord notification helpers
// ---------------------------------------------------------------------------

async function sendDiscordNotification(notifType, item, settings) {
  const webhookUrl = config?.watch?.contentChannelWebhook;
  if (!webhookUrl || !webhookUrl.startsWith("http")) return null;

  if (notifType === "live" && !settings?.notify_discord_on_live) return null;
  if (notifType === "upload" && !settings?.notify_discord_on_upload) return null;

  try {
    const webhook = new WebhookClient({ url: webhookUrl });

    const isLive = notifType === "live";
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(
        isLive
          ? `${item.creatorDisplayName} is live on YouTube!`
          : `New CFC video: ${item.title}`
      )
      .setDescription(item.title || "")
      .setURL(item.watch_url)
      .setTimestamp();

    if (item.thumbnail_url) embed.setImage(item.thumbnail_url);

    const pingRole = config?.watch?.contentPingRoleId;
    const content = pingRole ? `<@&${pingRole}>` : undefined;

    const msg = await webhook.send({ content, embeds: [embed] });
    return msg?.id || "sent";
  } catch (err) {
    console.error("[WatchYouTube] Discord notification failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// YouTube API helpers
// ---------------------------------------------------------------------------

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function fetchYoutubeVideoDetails(videoIds, apiKey, fetchFn) {
  if (!videoIds || videoIds.length === 0) return [];

  const ids = videoIds.slice(0, 50).join(",");
  const url = `${YT_BASE}/videos?part=snippet,liveStreamingDetails&id=${encodeURIComponent(ids)}&key=${encodeURIComponent(apiKey)}`;

  const res = await fetchFn(url);
  if (!res.ok) {
    console.error("[WatchYouTube] videos.list API error:", res.status);
    return [];
  }

  const data = await res.json();
  return data?.items || [];
}

async function fetchRecentChannelItems(channelId, apiKey, fetchFn) {
  // Fetch recent uploads (videos + live)
  const url = `${YT_BASE}/search?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&order=date&maxResults=15&key=${encodeURIComponent(apiKey)}`;

  const res = await fetchFn(url);
  if (!res.ok) {
    console.error("[WatchYouTube] search.list API error:", res.status);
    return [];
  }

  const data = await res.json();
  return data?.items || [];
}

// ---------------------------------------------------------------------------
// Sync logic for a single creator
// ---------------------------------------------------------------------------

async function syncYoutubeCreator(creator, apiKey, fetchFn) {
  const channelId = creator.platform_channel_id || creator.platform_account_id;

  try {
    const searchItems = await fetchRecentChannelItems(channelId, apiKey, fetchFn);
    if (searchItems.length === 0) {
      await updateSyncStatus(creator.user_id, "youtube", { success: true });
      return;
    }

    const videoIds = searchItems.map((i) => i.id?.videoId).filter(Boolean);
    const videoDetails = await fetchYoutubeVideoDetails(videoIds, apiKey, fetchFn);

    for (const video of videoDetails) {
      const snippet = video.snippet || {};
      const liveDetails = video.liveStreamingDetails || null;

      const tags = Array.isArray(snippet.tags) ? snippet.tags : [];
      const description = snippet.description || "";
      const title = snippet.title || "";
      const liveBroadcastContent = snippet.liveBroadcastContent; // "live", "upcoming", "none"

      const matchedRule = matchesCfcFilter(
        "youtube",
        { title, description, tags },
        config
      );

      const isCfc = Boolean(matchedRule);

      // Determine content type and live status
      const isCurrentlyLive = liveBroadcastContent === "live";
      const contentType = isCurrentlyLive || liveBroadcastContent === "upcoming" ? "live_stream" : "video";

      // Only expose to public if CFC-related and actually published/live
      const isPublic = isCfc && liveBroadcastContent !== "upcoming";

      const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : null;
      const startedAt = liveDetails?.actualStartTime ? new Date(liveDetails.actualStartTime) : null;
      const endedAt = liveDetails?.actualEndTime ? new Date(liveDetails.actualEndTime) : null;

      // Skip if it's still upcoming
      if (liveBroadcastContent === "upcoming") continue;

      const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;

      // Best thumbnail
      const thumbs = snippet.thumbnails || {};
      const thumbnailUrl =
        thumbs.maxres?.url ||
        thumbs.high?.url ||
        thumbs.medium?.url ||
        thumbs.default?.url ||
        null;

      const contentItem = {
        user_id: creator.user_id,
        platform: "youtube",
        external_content_id: video.id,
        external_channel_id: channelId,
        content_type: contentType,
        title,
        description: description.substring(0, 500),
        thumbnail_url: thumbnailUrl,
        watch_url: watchUrl,
        tags_json: JSON.stringify(tags),
        is_live: isCurrentlyLive ? 1 : 0,
        published_at: publishedAt,
        started_at: startedAt,
        ended_at: endedAt,
        matched_rule: matchedRule,
        is_cfc_related: isCfc ? 1 : 0,
        is_publicly_visible: isPublic ? 1 : 0,
      };

      await upsertContentItem(contentItem);

      if (!isPublic) continue;

      // Discord notifications
      const notifType = isCurrentlyLive ? "live" : "upload";
      const alreadySent = await hasNotificationBeenSent("youtube", video.id, notifType);
      if (!alreadySent) {
        const messageId = await sendDiscordNotification(
          notifType,
          {
            ...contentItem,
            creatorDisplayName: creator.platform_display_name || creator.username,
          },
          creator
        );
        await recordNotification("youtube", video.id, notifType, messageId);
      }
    }

    await updateSyncStatus(creator.user_id, "youtube", { success: true });
  } catch (err) {
    console.error(`[WatchYouTube] Sync failed for user ${creator.user_id}:`, err);
    await updateSyncStatus(creator.user_id, "youtube", { success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Cron schedule: every 15 minutes
// ---------------------------------------------------------------------------

let isYoutubeSyncRunning = false;

const youtubeSyncTask = cron.schedule("*/15 * * * *", async () => {
  const apiKey = process.env.youtubeApiKey;
  if (!apiKey) return;

  if (isYoutubeSyncRunning) return;
  isYoutubeSyncRunning = true;

  try {
    const { default: fetch } = await import("node-fetch");
    const creators = await getEligibleCreators("youtube");
    if (creators.length === 0) return;

    for (const creator of creators) {
      await syncYoutubeCreator(creator, apiKey, fetch);
    }
  } catch (err) {
    console.error("[WatchYouTube] Cron error:", err);
  } finally {
    isYoutubeSyncRunning = false;
  }
});

youtubeSyncTask.start();
