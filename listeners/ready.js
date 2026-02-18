import { Listener } from "@sapphire/framework";
import { reconcileActivePunishments } from "../cron/punishmentExpiryCron.js";

export class ReadyListener extends Listener {
  async run(client) {
    const { username, id } = client.user;
    this.container.logger.info(
      `[CONSOLE] [DISCORD] Successfully logged in as ${username} (${id})`
    );

    // Reconcile active Discord punishments on startup
    try {
      await reconcileActivePunishments();
    } catch (error) {
      this.container.logger.error("[DISCORD] Punishment reconciliation failed:", error);
    }
  }
}
