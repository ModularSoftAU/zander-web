import fetch from "node-fetch";
import { getGlobalImage, isLoggedIn, setBannerCookie } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import {
  createPendingPurchase,
  findWebstoreItem,
  formatPrice,
  getWebstoreItems,
} from "../controllers/webstoreController.js";

async function createStripeCheckoutSession({ item, userId, minecraftUsername }) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Stripe secret key is not configured");
  }

  const body = new URLSearchParams();
  body.append("mode", item.purchaseType === "subscription" ? "subscription" : "payment");
  body.append("line_items[0][price]", item.stripePriceId);
  body.append("line_items[0][quantity]", "1");
  body.append(
    "success_url",
    `${process.env.siteAddress}/webstore/thank-you?session_id={CHECKOUT_SESSION_ID}`
  );
  body.append("cancel_url", `${process.env.siteAddress}/webstore?canceled=1`);
  body.append("client_reference_id", String(userId));
  body.append("metadata[itemSlug]", item.slug);
  body.append("metadata[minecraftUsername]", minecraftUsername);
  body.append("metadata[userId]", String(userId));

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export default function webstoreRoutes(app, config, features) {
  app.get("/webstore", async function (req, res) {
    if (!isLoggedIn(req)) {
      return res.redirect(`/login?returnTo=/webstore`);
    }

    if (req.query?.canceled) {
      setBannerCookie("info", "Checkout canceled. You can try again anytime.", res);
    }

    if (!req.session?.user?.username) {
      setBannerCookie(
        "warning",
        "Please verify your Minecraft account before purchasing.",
        res
      );
      return res.redirect("/profile");
    }

    const items = getWebstoreItems().map((item) => ({
      ...item,
      priceDisplay: formatPrice(item.priceCents, item.currency),
      purchaseLabel:
        item.purchaseType === "subscription" ? "Subscribe" : "Buy once",
    }));

    return res.view("webstore/index", {
      pageTitle: "Webstore",
      config,
      req,
      features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      items,
      username: req.session.user.username,
    });
  });

  app.get("/webstore/thank-you", async function (req, res) {
    if (!isLoggedIn(req)) {
      return res.redirect(`/login?returnTo=/webstore/thank-you`);
    }

    return res.view("webstore/thank-you", {
      pageTitle: "Thank you",
      config,
      req,
      features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/webstore/checkout", async function (req, res) {
    if (!isLoggedIn(req)) {
      return res.redirect(`/login?returnTo=/webstore`);
    }

    const itemSlug = req.body.itemSlug ? req.body.itemSlug.trim() : "";
    const item = findWebstoreItem(itemSlug);

    if (!item) {
      setBannerCookie("warning", "That item is no longer available.", res);
      return res.redirect("/webstore");
    }

    if (!item.stripePriceId) {
      setBannerCookie("danger", "Stripe price ID is missing for this item.", res);
      return res.redirect("/webstore");
    }

    const minecraftUsername = req.session?.user?.username;
    if (!minecraftUsername) {
      setBannerCookie(
        "warning",
        "Please verify your Minecraft account before purchasing.",
        res
      );
      return res.redirect("/profile");
    }

    try {
      const session = await createStripeCheckoutSession({
        item,
        userId: req.session.user.userId,
        minecraftUsername,
      });

      await createPendingPurchase({
        userId: req.session.user.userId,
        item,
        minecraftUsername,
        stripeSessionId: session.id,
      });

      if (!session.url) {
        setBannerCookie("danger", "Stripe checkout was not created.", res);
        return res.redirect("/webstore");
      }

      return res.redirect(session.url);
    } catch (error) {
      console.error("Failed to create Stripe checkout session", error);
      setBannerCookie(
        "danger",
        "We could not start checkout right now. Please try again soon.",
        res
      );
      return res.redirect("/webstore");
    }
  });
}
