import fetch from "node-fetch";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { Colors } from "discord.js";
import { sendWebhookMessage } from "../../lib/discord/webhooks.mjs";
import crypto from "crypto";
import {
  createTransactionsForPurchase,
  findWebstoreItem,
  getPurchaseBySessionId,
  hasWebhookEvent,
  insertCommandRuns,
  recordWebhookEvent,
  resolveCommandTemplate,
  updatePurchasePayment,
  updatePurchaseStatus,
} from "../../controllers/webstoreController.js";

function parseStripeSignature(signatureHeader) {
  if (!signatureHeader) return null;

  const parts = signatureHeader.split(",");
  const signatureData = {
    timestamp: null,
    signatures: [],
  };

  parts.forEach((part) => {
    const [key, value] = part.split("=").map((entry) => entry.trim());
    if (key === "t") signatureData.timestamp = Number(value);
    if (key === "v1") signatureData.signatures.push(value);
  });

  if (!signatureData.timestamp || !signatureData.signatures.length) {
    return null;
  }

  return signatureData;
}

function computeStripeSignature(secret, payload, timestamp) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

function verifyStripeSignature({ signatureHeader, payload, secret }) {
  const signatureData = parseStripeSignature(signatureHeader);
  if (!signatureData) return false;

  const expectedSignature = computeStripeSignature(
    secret,
    payload,
    signatureData.timestamp
  );

  const signatureMatch = signatureData.signatures.some((signature) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  });

  if (!signatureMatch) return false;

  const toleranceSeconds = 300;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - signatureData.timestamp) <= toleranceSeconds;
}

function normalizeCurrency(currency) {
  return (currency || "usd").toLowerCase();
}

export default function webstoreWebhookRoutes(app, config) {
  const baseEndpoint = "/api/webstore";

  app.post(`${baseEndpoint}/stripe/webhook`, async function (req, res) {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      res.status(400);
      return res.send({ success: false, message: "Missing Stripe webhook configuration." });
    }

    const rawBody = req.body;
    if (!rawBody) {
      res.status(400);
      return res.send({ success: false, message: "Missing webhook payload." });
    }

    const payload = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);

    if (
      !verifyStripeSignature({
        signatureHeader: signature,
        payload,
        secret: webhookSecret,
      })
    ) {
      res.status(400);
      return res.send({ success: false, message: "Webhook signature verification failed." });
    }

    let event;
    try {
      event = JSON.parse(payload);
    } catch (error) {
      res.status(400);
      return res.send({ success: false, message: "Invalid JSON payload." });
    }

    try {
      if (await hasWebhookEvent(event.id)) {
        return res.send({ success: true, message: "Duplicate event ignored." });
      }

      if (event.type !== "checkout.session.completed") {
        await recordWebhookEvent({
          stripeEventId: event.id,
          purchaseId: null,
          eventType: event.type,
          payload: event,
        });
        return res.send({ success: true, message: "Event ignored." });
      }

      const session = event.data.object;
      const stripeSessionId = session.id;
      const purchase = await getPurchaseBySessionId(stripeSessionId);

      if (!purchase) {
        await recordWebhookEvent({
          stripeEventId: event.id,
          purchaseId: null,
          eventType: event.type,
          payload: event,
        });
        return res.send({ success: false, message: "Purchase record not found." });
      }

      if (session.payment_status && session.payment_status !== "paid") {
        await recordWebhookEvent({
          stripeEventId: event.id,
          purchaseId: purchase.purchaseId,
          eventType: event.type,
          payload: event,
        });
        return res.send({ success: true, message: "Payment not completed yet." });
      }

      if (purchase.status && purchase.status !== "pending") {
        await recordWebhookEvent({
          stripeEventId: event.id,
          purchaseId: purchase.purchaseId,
          eventType: event.type,
          payload: event,
        });
        return res.send({ success: true, message: "Purchase already processed." });
      }

      const item = await findWebstoreItem(purchase.itemSlug);
      await updatePurchasePayment({
        purchaseId: purchase.purchaseId,
        status: "paid",
        paymentIntentId: session.payment_intent,
        subscriptionId: session.subscription,
      });

      await recordWebhookEvent({
        stripeEventId: event.id,
        purchaseId: purchase.purchaseId,
        eventType: event.type,
        payload: event,
      });

      if (!item || !Array.isArray(item.commandTemplates) || !item.commandTemplates.length) {
        await updatePurchaseStatus(purchase.purchaseId, "fulfilled");
      } else {
        const metadata = {
          username: purchase.recipientMinecraftUsername,
          purchaserUsername: purchase.purchaserMinecraftUsername,
          purchaseId: purchase.purchaseId,
          itemSlug: purchase.itemSlug,
          purchaseType: purchase.purchaseType,
          isGift: purchase.isGift === 1 || purchase.isGift === true,
        };

        const tasks = item.commandTemplates.map((command) => ({
          slug: `webstore-${purchase.itemSlug}`,
          command,
        }));

        const response = await fetch(
          `${process.env.siteAddress}/api/bridge/processor/command/add`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-access-token": process.env.apiKey,
            },
            body: JSON.stringify({
              tasks,
              metadata,
              priority: 5,
            }),
          }
        );

        const responseData = await response.json();
        if (!responseData.success) {
          await updatePurchaseStatus(purchase.purchaseId, "failed");
        } else {
          const tasksResponse = Array.isArray(responseData.data) ? responseData.data : [];
          const commandRuns = tasksResponse.map((task, index) => {
            const template = item.commandTemplates[index] || task.command;
            return {
              purchaseId: purchase.purchaseId,
              commandTemplate: template,
              resolvedCommand: resolveCommandTemplate(template, metadata),
              executorTaskId: task.executorTaskId,
              status: task.status === "completed" ? "completed" : "queued",
              attempts: 0,
            };
          });

          if (commandRuns.length) {
            await insertCommandRuns(commandRuns);
          }
        }
      }

      await createTransactionsForPurchase({
        purchaseId: purchase.purchaseId,
        payerUserId: purchase.userId,
        payerMinecraftUsername: purchase.purchaserMinecraftUsername,
        recipientMinecraftUsername: purchase.recipientMinecraftUsername,
        amountCents: purchase.amountCents,
        currency: purchase.currency,
      });

      if (config?.discord?.webhooks?.staffChannel) {
        const staffChannelHook = new Webhook(config.discord.webhooks.staffChannel);
        const embed = new MessageBuilder()
          .setTitle(`${purchase.itemName} Purchased`)
          .addField("Player", purchase.recipientMinecraftUsername, true)
          .addField("Type", purchase.purchaseType === "subscription" ? "Subscription" : "One-time", true)
          .addField(
            "Amount",
            `${normalizeCurrency(purchase.currency).toUpperCase()} ${purchase.amountCents / 100}`,
            true
          )
          .addField("Gifted", purchase.isGift ? "Yes" : "No", true)
          .setColor(Colors.Green)
          .setTimestamp();

        await sendWebhookMessage(staffChannelHook, embed, { context: "webstore#purchase" });
      }

      return res.send({ success: true });
    } catch (error) {
      console.error("Stripe webhook processing error", error);
      return res.status(500).send({ success: false, message: "Webhook processing failed." });
    }
  });
}
