import { Command, RegisterBehavior } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import features from "../features.json" assert { type: "json" };

export class LegoFlipCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("legoflip")
        .setDescription("A simple lego flip! (Coin flip)")
    );
  }

  async chatInputRun(interaction) {
    if (features.discord.commands.legoFlip) {
      if (Math.random() < 0.5) {
        const embed = new EmbedBuilder()
          .setTitle(`Lego Flip!`)
          .setImage(
            `https://crafatar.com/avatars/2a881594693543c99c39ec31374d46fe?overlay`
          );

        interaction.reply({
          embeds: [embed],
          empheral: false,
        });
      } else {
        const embed = new EmbedBuilder()
          .setTitle(`Lego Flip!`)
          .setImage(
            `https://crafatar.com/avatars/21a6469871f04578830a2ab0ac2f4d48?overlay`
          );

        interaction.reply({
          embeds: [embed],
          empheral: false,
        });
      }
    } else {
      interaction.reply(
        "This feature has been disabled by the System Administrator."
      );
    }
  }
}
