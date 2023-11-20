import { Listener } from "@sapphire/framework";
import config from "../config.json" assert { type: "json" };
import { Colors, EmbedBuilder } from "discord.js";
import features from "../features.json" assert { type: "json" };

export class GuildMemberBoostUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "guildMemberUpdate",
    });
  }

  run(oldMember, newMember) {
    if (features.discord.events.guildMemberBoost) {
      if (!newMember.guild) return;
      if (newMember.user.bot) return;

      const oldStatus = oldMember.premiumSince;
      const newStatus = newMember.premiumSince;

      let welcomechannel = newMember.guild.channels.cache.find(
        (c) => c.id === config.discord.channels.welcome
      );
      if (!welcomechannel) return;

      if (!oldStatus && newStatus) {
        let embed = new EmbedBuilder()
          .setTitle(
            `\`${newMember.user.username}\` has boosted the Server! :tada:`
          )
          .setColor(Colors.DarkVividPink);
        welcomechannel.send({ embeds: [embed] });
      }
      return;
    }
  }
}
