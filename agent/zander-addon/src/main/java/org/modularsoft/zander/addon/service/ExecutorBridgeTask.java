package org.modularsoft.zander.addon.service;

import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitRunnable;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.service.BridgeService.ExecutorTask;

import java.util.List;

/**
 * Polls the web executor task queue on a timer, runs each claimed command as
 * console on the main thread, and reports completed/failed back.
 *
 * Schedule with runTaskTimerAsynchronously — run() does the HTTP work off the
 * main thread and only hops onto it for command dispatch.
 */
public class ExecutorBridgeTask extends BukkitRunnable {
    private static final int BATCH_LIMIT = 50;

    private final ZanderAddonMain plugin;
    private final BridgeService bridge;

    public ExecutorBridgeTask(ZanderAddonMain plugin, BridgeService bridge) {
        this.plugin = plugin;
        this.bridge = bridge;
    }

    @Override
    public void run() {
        final List<ExecutorTask> tasks;
        try {
            tasks = bridge.pollExecutorTasks(BATCH_LIMIT);
        } catch (Exception e) {
            plugin.getLogger().warning("[bridge] executor poll failed: " + e.getMessage());
            return;
        }
        if (tasks.isEmpty()) return;

        Bukkit.getScheduler().runTask(plugin, () -> {
            for (ExecutorTask task : tasks) {
                String status = "completed";
                String result = null;
                try {
                    boolean ok = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), stripSlash(task.command));
                    if (!ok) {
                        status = "failed";
                        result = "dispatchCommand returned false (unknown command or refused)";
                    }
                } catch (Exception ex) {
                    status = "failed";
                    result = ex.getClass().getSimpleName() + ": " + ex.getMessage();
                    plugin.getLogger().warning("[bridge] executor task " + task.id + " threw: " + ex.getMessage());
                }

                final String fStatus = status;
                final String fResult = result;
                Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
                    try {
                        bridge.reportExecutorTask(task.id, fStatus, fResult);
                    } catch (Exception e) {
                        plugin.getLogger().warning("[bridge] executor report failed for task " + task.id + ": " + e.getMessage());
                    }
                });
            }
        });
    }

    private static String stripSlash(String command) {
        return command != null && command.startsWith("/") ? command.substring(1) : command;
    }
}
