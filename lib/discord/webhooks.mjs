function buildContextLabel(context) {
  if (!context) {
    return "[Webhook]";
  }

  return `[Webhook:${context}]`;
}

export async function sendWebhookMessage(
  webhook,
  payload,
  { context = null, onError = null } = {}
) {
  try {
    await webhook.send(payload);
    return true;
  } catch (error) {
    const contextLabel = buildContextLabel(context);
    const message = error?.message ?? String(error);
    const response = error?.response ?? null;
    const formattedResponse =
      response && typeof response !== "string"
        ? JSON.stringify(response)
        : response;

    if (formattedResponse) {
      console.error(
        `${contextLabel} Failed to send webhook: ${message}. Response: ${formattedResponse}`
      );
    } else {
      console.error(`${contextLabel} Failed to send webhook: ${message}`);
    }

    if (typeof onError === "function") {
      try {
        onError(error);
      } catch (callbackError) {
        console.error(
          `${contextLabel} Error while executing webhook error handler`,
          callbackError
        );
      }
    }

    return false;
  }
}
