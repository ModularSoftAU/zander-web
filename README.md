# zander-web
The web component of the Zander project that contains database, API and website.

Documentation: [https://modularsoft.org/docs/products/zander](https://modularsoft.org/docs/products/zander)

## Tebex bridge integration

The `/api/tebex/webhook` endpoint accepts Tebex purchase webhooks and queues bridge tasks for any packages configured in `tebex.json`. Update the mapping file with your package IDs, the commands or rank assignments to trigger, and (optionally) override the target slug or priority per action.

Secure the webhook by setting the `TEBEX_WEBHOOK_SECRET` environment variable (or the legacy `tebexWebhookSecret`). Requests must include the matching token via an `Authorization`, `X-Tebex-Secret`, or `X-Webhook-Secret` header.
