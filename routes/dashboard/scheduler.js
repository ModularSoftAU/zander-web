import {
  getGlobalImage,
  hasPermission,
  isFeatureWebRouteEnabled,
} from "../../api/common.js";
import { getWebAnnouncement } from "../../controllers/announcementController.js";
import { ChannelType } from "discord.js";

export default function dashboardSchedulerSiteRoute(
  app,
  client,
  fetch,
  config,
  features,
  lang
) {
  app.get("/dashboard/scheduler", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.discord, req, res, features)) return;

    if (!hasPermission("zander.web.scheduler", req, res, features)) return;

    const announcementsResponse = await fetch(
      `${process.env.siteAddress}/api/announcement/get`,
      {
        headers: { "x-access-token": process.env.apiKey },
      }
    );
    const announcementsData = await announcementsResponse.json();

    const scheduledResponse = await fetch(
      `${process.env.siteAddress}/api/scheduler/discord/get`,
      {
        headers: { "x-access-token": process.env.apiKey },
      }
    );
    const scheduledMessages = await scheduledResponse.json();

    const guildId = config.discord?.guildId ?? process.env.DISCORD_GUILD_ID;
    const discordChannels = [];

    if (guildId && client?.isReady?.()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        const channels = await guild.channels.fetch();
        channels.forEach((channel) => {
          if (
            channel &&
            (channel.type === ChannelType.GuildText ||
              channel.type === ChannelType.GuildAnnouncement)
          ) {
            discordChannels.push({
              id: channel.id,
              name: channel.name,
            });
          }
        });
      } catch (error) {
        console.error("Failed to load Discord channels for scheduler", error);
      }
    }

    res.view("dashboard/scheduler/scheduler-index", {
      pageTitle: `Dashboard - Scheduler`,
      config: config,
      features: features,
      req: req,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      announcementsData: announcementsData,
      scheduledMessages: scheduledMessages,
      discordChannels: discordChannels,
    });

    return res;
  });
}
