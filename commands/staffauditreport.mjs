import { Command } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import { hasPermission } from "../lib/discord/permissions.mjs";
import {
  getUserPermissions,
  UserGetter,
} from "../controllers/userController.js";
import { runStaffAuditReport } from "../cron/staffAuditReportCron.js";

const AUDIT_PERMISSION_NODE = "zander.web.audit";

export class StaffAuditReportCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("staff-audit-report")
        .setDescription("Manually trigger the staff activity audit report.")
    );
  }

  async chatInputRun(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("Failed to defer staff-audit-report reply", error);
      return;
    }

    const userGetter = new UserGetter();
    const linkedAccount = await userGetter.byDiscordId(interaction.user.id);

    if (!linkedAccount) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Linked Account")
            .setDescription(
              "Link your Minecraft account on the website before using this command."
            )
            .setColor(Colors.Red),
        ],
      });
    }

    const userPermissions = await getUserPermissions(linkedAccount);
    if (!hasPermission(userPermissions, AUDIT_PERMISSION_NODE)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Permission")
            .setDescription("You do not have access to use this command.")
            .setColor(Colors.Red),
        ],
      });
    }

    try {
      await runStaffAuditReport();
    } catch (error) {
      console.error("Failed to run staff audit report manually", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Report Failed")
            .setDescription(
              "The staff audit report failed to run. Check server logs for details."
            )
            .setColor(Colors.Red),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Staff Audit Report Sent")
          .setDescription(
            "The staff activity audit report has been posted to the configured webhook."
          )
          .setColor(Colors.Green)
          .setTimestamp(new Date()),
      ],
    });
  }
}
