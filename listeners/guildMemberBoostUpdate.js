import { Listener } from "@sapphire/framework";
import config from "../config.json" assert { type: "json" };
import { Colors, EmbedBuilder } from "discord.js";
import features from "../features.json" assert { type: "json" };
import { MessageBuilder, Webhook } from "discord-webhook-node";

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

      const welcomeHook = new Webhook(config.discord.webhooks.welcome);

      if (!oldStatus && newStatus) {
        let embed = new MessageBuilder()
          .setTitle(
            `\`${newMember.user.username}\` has boosted the Server! :tada:`
          )
          .setColor(Colors.DarkVividPink);
        welcomeHook.send(embed);
      }
      return;
    }
  }
}
