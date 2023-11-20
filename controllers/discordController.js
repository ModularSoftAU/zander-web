import { SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

//
// Discord
//
export const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  presence: {
    status: "online",
    activities: [
      {
        name: process.env.siteAddress,
        type: "PLAYING",
      },
    ],
  },
});

client.login(process.env.discordAPIKey);

/*
    It

    @param username The username of the user.
*/
export async function isBot() {
  const user = client.users.cache.get(userId);
  if (user) {
    return user.bot;
  }
  return false;
}
