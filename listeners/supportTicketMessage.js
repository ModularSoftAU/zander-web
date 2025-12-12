import { Listener } from "@sapphire/framework";
import {
    createSupportTicketMessage,
    getTicketByChannelId,
    getUserIdByDiscordId,
    createUnlinkedUser,
} from "../controllers/supportTicketController.js";
import { ImgurClient } from "imgur";

const imgurClient = new ImgurClient({
    clientId: process.env.IMGUR_CLIENT_ID,
    clientSecret: process.env.IMGUR_CLIENT_SECRET,
    refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

export class SupportTicketMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "messageCreate",
    });
  }

  async run(message) {
    if (message.author.bot) return;

    const ticket = await getTicketByChannelId(message.channel.id);

    if (ticket) {
      let attachmentUrl = null;
      if (message.attachments.size > 0) {
        try {
            const attachment = message.attachments.first();
            const response = await imgurClient.upload({
              image: attachment.url,
              type: "url",
            });
            attachmentUrl = response.data.link;
        } catch (error) {
            console.error(error);
        }
      }

      let userId = await getUserIdByDiscordId(message.author.id);
      if (!userId) {
        userId = await createUnlinkedUser(message.author.id, message.author.username);
      }

      await createSupportTicketMessage(
        this.container.client,
        ticket.ticketId,
        userId,
        message.content,
        attachmentUrl,
        "discord"
      );
    }
  }
}
