import { Listener } from "@sapphire/framework";
import { handleTicketClose, startTicketFlow } from "../lib/discord/ticketFlow.mjs";

export class SupportTicketInteractionsListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("support_ticket_open")) {
        const [, parentCategoryId] = interaction.customId.split(":");
        return startTicketFlow(interaction, { parentCategoryId });
      }

      if (interaction.customId === "support_ticket_close") {
        return handleTicketClose(interaction);
      }
    }
  }
}
