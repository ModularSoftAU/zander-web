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
      if (interaction.customId === "support_ticket_open") {
        return startTicketFlow(interaction);
      }

      if (interaction.customId === "support_ticket_close") {
        return handleTicketClose(interaction);
      }
    }
  }
}
