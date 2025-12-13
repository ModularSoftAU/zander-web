import { getWebAnnouncement } from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common.js";
import { ImgurClient } from "imgur";
import {
    getSupportCategories,
    createSupportTicket,
    createSupportTicketMessage,
    getUserIdByEmail,
    createUnlinkedUser,
} from "../controllers/supportTicketController.js";

const imgurClient = new ImgurClient({
    clientId: process.env.IMGUR_CLIENT_ID,
    clientSecret: process.env.IMGUR_CLIENT_SECRET,
    refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

export default function supportSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  app.get("/support/create", async function (req, res) {
    const categories = await getSupportCategories();

    return res.view("modules/support/create", {
      pageTitle: "Create Support Ticket",
      config,
      req,
      features,
      categories,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/support/create", async function (req, res) {
    const { title, category, message, email, username } = req.body;
    const attachment = req.raw.files ? req.raw.files.attachment : null;
    let attachmentUrl = null;

    if (attachment) {
        try {
            const response = await imgurClient.upload({
                image: attachment.data,
                type: "stream",
            });
            attachmentUrl = response.data.link;
        } catch (error) {
            console.error(error);
        }
    }

    let userId = await getUserIdByEmail(email);

    if (!userId) {
      userId = await createUnlinkedUser(null, username, email);
    }

    const ticketId = await createSupportTicket(
      client,
      userId,
      category,
      title
    );
    await createSupportTicketMessage(
      client,
      ticketId,
      userId,
      message,
      attachmentUrl
    );

    return res.redirect("/support/success");
  });

  app.get("/support/success", async function (req, res) {
    return res.view("modules/support/success", {
        pageTitle: "Ticket Submitted",
        config,
        req,
        features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
    });
    });
}
