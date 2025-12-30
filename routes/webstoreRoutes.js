import fetch from "node-fetch";
import { getGlobalImage, isLoggedIn, setBannerCookie } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import {
  createPendingPurchase,
  findWebstoreItem,
  formatPrice,
  getWebstoreItems,
  getMonthlyPurchaseTotals,
} from "../controllers/webstoreController.js";

async function createStripeCheckoutSession({
  item,
  userId,
  minecraftUsername,
  purchaserMinecraftUsername,
  isGift,
}) {
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
  body.append("metadata[purchaserMinecraftUsername]", purchaserMinecraftUsername);
  body.append("metadata[isGift]", isGift ? "true" : "false");
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
    if (req.query?.canceled) {
      setBannerCookie("info", "Checkout canceled. You can try again anytime.", res);
    }

    const loggedIn = isLoggedIn(req);

    if (loggedIn && !req.session?.user?.username) {
      setBannerCookie(
        "warning",
        "Please verify your Minecraft account before purchasing.",
        res
      );
      return res.redirect("/profile");
    }

    let items = [];
    try {
      items = (await getWebstoreItems()).map((item) => ({
        ...item,
        priceDisplay: formatPrice(item.priceCents, item.currency),
        purchaseLabel:
          item.purchaseType === "subscription" ? "Subscribe" : "Buy once",
      }));
    } catch (error) {
      console.error("Failed to load webstore items", error);
      setBannerCookie("warning", "Webstore items are unavailable right now.", res);
    }

    return res.view("webstore/index", {
      pageTitle: "Webstore",
      config,
      req,
      features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      items,
      username: loggedIn ? req.session.user.username : null,
      loggedIn,
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
    const item = await findWebstoreItem(itemSlug);

    if (!item) {
      setBannerCookie("warning", "That item is no longer available.", res);
      return res.redirect("/webstore");
    }

    if (!item.stripePriceId) {
      setBannerCookie("danger", "Stripe price ID is missing for this item.", res);
      return res.redirect("/webstore");
    }

    const purchaserMinecraftUsername = req.session?.user?.username;
    if (!purchaserMinecraftUsername) {
      setBannerCookie(
        "warning",
        "Please verify your Minecraft account before purchasing.",
        res
      );
      return res.redirect("/profile");
    }

    const recipientUsernameRaw = req.body.recipientUsername
      ? req.body.recipientUsername.trim()
      : "";
    const recipientMinecraftUsername = recipientUsernameRaw || purchaserMinecraftUsername;

    if (!/^[A-Za-z0-9_]{1,16}$/.test(recipientMinecraftUsername)) {
      setBannerCookie(
        "warning",
        "Recipient Minecraft username must be 1-16 characters.",
        res
      );
      return res.redirect("/webstore");
    }

    try {
      const session = await createStripeCheckoutSession({
        item,
        userId: req.session.user.userId,
        minecraftUsername: recipientMinecraftUsername,
        purchaserMinecraftUsername,
        isGift: recipientMinecraftUsername !== purchaserMinecraftUsername,
      });

      await createPendingPurchase({
        userId: req.session.user.userId,
        item,
        purchaserMinecraftUsername,
        recipientMinecraftUsername,
        stripeSessionId: session.id,
        isGift: recipientMinecraftUsername !== purchaserMinecraftUsername,
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

  app.get("/give", async function (req, res) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setMilliseconds(-1);

    const monthlyGoalCents =
      config?.siteConfiguration?.webstore?.monthlyGoalCents ??
      Number(process.env.WEBSTORE_MONTHLY_GOAL_CENTS || 100000);

    let raisedCents = 0;
    try {
      raisedCents = await getMonthlyPurchaseTotals(startOfMonth, endOfMonth);
    } catch (error) {
      console.error("Failed to load monthly webstore totals", error);
    }
    const progressPercent = monthlyGoalCents
      ? Math.min(100, Math.round((raisedCents / monthlyGoalCents) * 100))
      : 0;

    return res.view("give/index", {
      pageTitle: "Support the Server",
      config,
      req,
      features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      monthlyGoalCents,
      raisedCents,
      progressPercent,
    });
  });
}
