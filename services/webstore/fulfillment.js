/**
 * services/webstore/fulfillment.js
 *
 * Command execution: executorTasks queue for Minecraft commands, immediate Discord-role grants/revokes, deferred-role retry, and the high-level fulfill/renew/revoke orchestration + command-run sync helpers.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import { query } from "./_shared.js";
import { resolveCommandTemplate } from "./pricing.js";
import { updatePurchaseStatus } from "./purchases.js";

/**
 * Enqueue Minecraft console commands via executorTasks.
 * Each entry in `commands` is { commandTemplate, commandType } — only
 * entries with commandType === 'minecraft' are processed here.
 *
 * Returns an array of inserted commandRunIds.
 */
export async function enqueueCommands({
  purchaseId,
  stripeSubscriptionId = null,
  action,
  commands,
  metadata,
  priority = 5,
}) {
  if (!Array.isArray(commands) || !commands.length) return [];

  const minecraftCmds = commands.filter((c) => (c.commandType || "minecraft") === "minecraft");
  const runIds = [];

  for (const cmd of minecraftCmds) {
    const resolvedCommand = resolveCommandTemplate(cmd.commandTemplate, metadata);

    // Insert executor task — picked up by zander-addon and run as a console command.
    // Use the command's configured serverSlug so the right server claims the task.
    const taskSlug = cmd.serverSlug || "any";
    const taskResult = await query(
      `INSERT INTO executorTasks (slug, command, status, priority, metadata, createdAt, updatedAt)
       VALUES (?, ?, 'pending', ?, ?, NOW(), NOW())`,
      [
        taskSlug,
        resolvedCommand,
        priority,
        JSON.stringify({ source: "webstore", purchaseId, action, ...metadata }),
      ]
    );

    const executorTaskId = taskResult.insertId;

    const runResult = await query(
      `INSERT INTO webstoreCommandRuns
         (purchaseId, stripeSubscriptionId, action, commandTemplate,
          resolvedCommand, executorTaskId, status, attempts)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)`,
      [
        purchaseId,
        stripeSubscriptionId || null,
        action,
        cmd.commandTemplate,
        resolvedCommand,
        executorTaskId,
      ]
    );

    runIds.push(runResult.insertId);
  }

  return runIds;
}

/**
 * Execute Discord role commands immediately (no queue needed — Discord API is fast).
 * Each entry in `commands` with commandType === 'discord_role' causes a role
 * add (grant) or remove (revoke) on the recipient's linked Discord account.
 *
 * @param {object} opts
 * @param {number}   opts.purchaseId
 * @param {string|null} opts.stripeSubscriptionId
 * @param {'grant'|'revoke'} opts.action
 * @param {Array<{commandTemplate:string, commandType:string}>} opts.commands
 * @param {string}   opts.recipientMinecraftUsername
 * @param {object}   opts.discordClient  - Discord.js client
 * @param {string}   opts.guildId        - Discord guild ID from config
 */
export async function executeDiscordRoleCommands({
  purchaseId,
  stripeSubscriptionId = null,
  action,
  commands,
  recipientMinecraftUsername,
  discordClient,
  guildId,
}) {
  const roleCmds = (commands || []).filter((c) => c.commandType === "discord_role");
  if (!roleCmds.length) return;

  // Look up the recipient's Discord ID via their Minecraft username
  const userRows = await query(
    "SELECT discordId FROM users WHERE username = ? LIMIT 1",
    [recipientMinecraftUsername]
  );
  const discordId = userRows?.[0]?.discordId;

  if (!discordId) {
    console.warn(
      `[webstore] discord_role ${action}: no Discord account linked for "${recipientMinecraftUsername}" — deferring role commands until they link`
    );
    // 'deferred', not 'failed': the rest of the purchase still delivered, and
    // retryDeferredDiscordRoles() re-drives these when the recipient links their
    // Discord account.
    for (const cmd of roleCmds) {
      await query(
        `INSERT INTO webstoreCommandRuns
           (purchaseId, stripeSubscriptionId, action, commandTemplate,
            resolvedCommand, executorTaskId, status, attempts, lastError)
         VALUES (?, ?, ?, ?, ?, NULL, 'deferred', 0, ?)`,
        [
          purchaseId,
          stripeSubscriptionId || null,
          action,
          cmd.commandTemplate,
          `discord_role:${action}:${cmd.commandTemplate.trim()}`,
          `Recipient "${recipientMinecraftUsername}" has no linked Discord account — deferred until they link`,
        ]
      );
    }
    return;
  }

  let member = null;
  try {
    const guild = discordClient?.guilds?.cache?.get(guildId);
    member = guild ? await guild.members.fetch(discordId).catch(() => null) : null;
  } catch {
    member = null;
  }

  for (const cmd of roleCmds) {
    const roleId = cmd.commandTemplate.trim();
    let status = "completed";
    let lastError = null;

    try {
      if (!member) throw new Error(`Guild member not found for Discord ID ${discordId}`);
      if (action === "grant") {
        await member.roles.add(roleId);
      } else {
        await member.roles.remove(roleId);
      }
    } catch (err) {
      status = "failed";
      lastError = err.message;
      console.error(
        `[webstore] discord_role ${action} role ${roleId} for ${recipientMinecraftUsername}:`,
        err.message
      );
    }

    await query(
      `INSERT INTO webstoreCommandRuns
         (purchaseId, stripeSubscriptionId, action, commandTemplate,
          resolvedCommand, executorTaskId, status, attempts, lastError)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 1, ?)`,
      [
        purchaseId,
        stripeSubscriptionId || null,
        action,
        cmd.commandTemplate,
        `discord_role:${action}:${roleId}`,
        status,
        lastError,
      ]
    );
  }
}

/**
 * Re-drive `discord_role` command runs that were left `deferred` because the
 * recipient had no linked Discord account at purchase time. Call this after a
 * user links their Discord account.
 *
 * @param {object} opts
 * @param {number} opts.userId       the Zander user who just linked Discord
 * @param {object} opts.discordClient Discord.js / Sapphire client
 * @param {string} opts.guildId       Discord guild ID (config.discord.guildId)
 * @returns {Promise<{processed:number, completed:number, failed:number}>}
 */
export async function retryDeferredDiscordRoles({ userId, discordClient, guildId }) {
  const result = { processed: 0, completed: 0, failed: 0 };
  if (!userId || !discordClient || !guildId) return result;

  const userRows = await query(
    "SELECT userId, username, discordId FROM users WHERE userId = ? LIMIT 1",
    [userId]
  );
  const user = userRows?.[0];
  if (!user?.discordId || !user?.username) return result;

  // Deferred discord_role runs for purchases whose *recipient* is this user.
  const runs = await query(
    `SELECT cr.commandRunId, cr.action, cr.commandTemplate
       FROM webstoreCommandRuns cr
       JOIN webstorePurchases p ON p.purchaseId = cr.purchaseId
      WHERE cr.status = 'deferred'
        AND cr.resolvedCommand LIKE 'discord_role:%'
        AND LOWER(p.recipientMinecraftUsername) = LOWER(?)`,
    [user.username]
  );
  if (!runs.length) return result;

  let member = null;
  try {
    const guild = discordClient?.guilds?.cache?.get(guildId) || (await discordClient.guilds.fetch(guildId));
    member = guild ? await guild.members.fetch(user.discordId).catch(() => null) : null;
  } catch {
    member = null;
  }

  for (const run of runs) {
    result.processed++;
    const roleId = String(run.commandTemplate || "").trim();
    let status = "completed";
    let lastError = null;
    try {
      if (!member) throw new Error(`Guild member not found for Discord ID ${user.discordId}`);
      if (run.action === "revoke") await member.roles.remove(roleId);
      else await member.roles.add(roleId);
    } catch (err) {
      status = "failed";
      lastError = err.message;
      console.error(
        `[webstore] retryDeferredDiscordRoles: ${run.action} role ${roleId} for ${user.username}:`,
        err.message
      );
    }
    await updateCommandRunStatus(run.commandRunId, status, lastError);
    if (status === "completed") result.completed++;
    else result.failed++;
  }

  console.info(
    `[webstore] retryDeferredDiscordRoles for ${user.username}: ` +
      `${result.completed} granted, ${result.failed} failed of ${result.processed}`
  );
  return result;
}

// ---------------------------------------------------------------------------
// High-level fulfillment helpers
// ---------------------------------------------------------------------------

/**
 * Run all grant commands for a completed purchase.
 * Minecraft commands are queued via executorTasks; Discord role commands run immediately.
 * Marks the purchase fulfilled if there are no commands at all.
 *
 * @param {object} purchase
 * @param {object} item
 * @param {{ discordClient, guildId }} [discord]
 */
export async function fulfillPurchase(purchase, item, discord = {}) {
  if (!item || !Array.isArray(item.grantCommands) || !item.grantCommands.length) {
    await updatePurchaseStatus(purchase.purchaseId, "fulfilled");
    return;
  }

  const metadata = buildCommandMetadata(purchase);
  await enqueueCommands({
    purchaseId: purchase.purchaseId,
    stripeSubscriptionId: purchase.stripeSubscriptionId || null,
    action: "grant",
    commands: item.grantCommands,
    metadata,
  });
  if (discord.discordClient) {
    await executeDiscordRoleCommands({
      purchaseId: purchase.purchaseId,
      stripeSubscriptionId: purchase.stripeSubscriptionId || null,
      action: "grant",
      commands: item.grantCommands,
      recipientMinecraftUsername: purchase.recipientMinecraftUsername,
      discordClient: discord.discordClient,
      guildId: discord.guildId,
    });
  }
}

/**
 * Run grant commands for a subscription renewal period.
 *
 * @param {object} subscription
 * @param {Array<{commandTemplate,commandType}>} grantCommands
 * @param {{ discordClient, guildId }} [discord]
 */
export async function fulfillSubscriptionRenewal(subscription, grantCommands, discord = {}) {
  if (!grantCommands.length) return;

  const metadata = {
    username: subscription.recipientMinecraftUsername,
    purchaserUsername: subscription.purchaserMinecraftUsername,
    purchaseId: subscription.purchaseId,
    itemSlug: subscription.stripePriceId,
    purchaseType: "subscription",
    isGift:
      subscription.recipientMinecraftUsername !== subscription.purchaserMinecraftUsername
        ? "true"
        : "false",
  };

  await enqueueCommands({
    purchaseId: subscription.purchaseId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    action: "grant",
    commands: grantCommands,
    metadata,
  });
  if (discord.discordClient) {
    await executeDiscordRoleCommands({
      purchaseId: subscription.purchaseId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      action: "grant",
      commands: grantCommands,
      recipientMinecraftUsername: subscription.recipientMinecraftUsername,
      discordClient: discord.discordClient,
      guildId: discord.guildId,
    });
  }
}

/**
 * Run revoke commands when a subscription is cancelled or expires.
 *
 * @param {object} subscription
 * @param {Array<{commandTemplate,commandType}>} revokeCommands
 * @param {{ discordClient, guildId }} [discord]
 */
export async function revokeSubscription(subscription, revokeCommands, discord = {}) {
  if (!revokeCommands.length) return;

  const metadata = {
    username: subscription.recipientMinecraftUsername,
    purchaserUsername: subscription.purchaserMinecraftUsername,
    purchaseId: subscription.purchaseId,
    itemSlug: subscription.stripePriceId,
    purchaseType: "subscription",
    isGift:
      subscription.recipientMinecraftUsername !== subscription.purchaserMinecraftUsername
        ? "true"
        : "false",
  };

  await enqueueCommands({
    purchaseId: subscription.purchaseId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    action: "revoke",
    commands: revokeCommands,
    metadata,
  });
  if (discord.discordClient) {
    await executeDiscordRoleCommands({
      purchaseId: subscription.purchaseId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      action: "revoke",
      commands: revokeCommands,
      recipientMinecraftUsername: subscription.recipientMinecraftUsername,
      discordClient: discord.discordClient,
      guildId: discord.guildId,
    });
  }
}

function buildCommandMetadata(purchase) {
  return {
    username: purchase.recipientMinecraftUsername,
    purchaserUsername: purchase.purchaserMinecraftUsername,
    purchaseId: purchase.purchaseId,
    itemSlug: purchase.itemSlug,
    purchaseType: purchase.purchaseType,
    isGift: purchase.isGift === 1 || purchase.isGift === true ? "true" : "false",
  };
}

// ---------------------------------------------------------------------------
// Command sync helpers (used by webstoreCommandSyncCron)
// ---------------------------------------------------------------------------

/**
 * Return command runs that are still queued or processing, joined with their
 * executor task status so the cron can update them accordingly.
 */
export async function getCommandRunsNeedingSync(limit = 100) {
  return query(
    `SELECT cr.commandRunId, cr.purchaseId, cr.executorTaskId, cr.status,
            cr.attempts, et.status AS taskStatus, et.result AS taskResult
     FROM webstoreCommandRuns cr
     JOIN executorTasks et ON cr.executorTaskId = et.executorTaskId
     WHERE cr.status IN ('queued', 'processing')
     ORDER BY cr.updatedAt ASC
     LIMIT ?`,
    [limit]
  );
}

export async function updateCommandRunStatus(commandRunId, status, lastError = null) {
  return query(
    `UPDATE webstoreCommandRuns
     SET status = ?, lastError = ?, updatedAt = NOW()
     WHERE commandRunId = ?`,
    [status, lastError, commandRunId]
  );
}

export async function incrementCommandRunAttempts(commandRunId, lastError = null) {
  return query(
    `UPDATE webstoreCommandRuns
     SET attempts = attempts + 1, lastError = ?, updatedAt = NOW()
     WHERE commandRunId = ?`,
    [lastError, commandRunId]
  );
}

/** Reset an executor task to pending so it is retried by zander-addon. */
export async function resetExecutorTask(executorTaskId) {
  return query(
    `UPDATE executorTasks
     SET status = 'pending', executedBy = NULL, result = NULL,
         processedAt = NULL, updatedAt = NOW()
     WHERE executorTaskId = ?`,
    [executorTaskId]
  );
}

/**
 * Return purchases that have at least one command run, so the cron can
 * determine whether to mark them fulfilled or failed.
 */
export async function getPurchasesWithPendingCommandRuns() {
  // 'deferred' is included so a purchase whose only outstanding run is a
  // deferred discord_role still gets rolled up to 'fulfilled' (the rollup
  // no-ops once the purchase status has settled).
  return query(
    `SELECT DISTINCT purchaseId
     FROM webstoreCommandRuns
     WHERE status IN ('queued', 'processing', 'deferred')`,
    []
  );
}

