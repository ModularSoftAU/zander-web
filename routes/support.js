import { getWebAnnouncement } from "../controllers/announcementController.js";
import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common.js";
import {
    getSupportCategories,
    createSupportTicket,
    createSupportTicketMessage,
    getUserIdByEmail,
    createUnlinkedUser,
} from "../controllers/supportTicketController.js";

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
      null
    );

    return res.redirect("/");
  });
}
