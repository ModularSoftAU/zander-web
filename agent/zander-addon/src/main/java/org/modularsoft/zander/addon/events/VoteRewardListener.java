package org.modularsoft.zander.addon.events;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.service.BridgeService;
import org.modularsoft.zander.addon.service.BridgeService.RewardCommand;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * On player join, claims any queued vote-reward commands for that player from
 * the web command bridge, runs them, and reports the outcome back.
 *
 * Flow per join:
 *   async  -> POST /command-bridge/claim
 *   main   -> dispatch each command (console, or as the player when executeAs
 *             is "player"/"self")
 *   async  -> POST /command-bridge/complete  (+ /fail for any that errored)
 */
public class VoteRewardListener implements Listener {
    private final ZanderAddonMain plugin;
    private final BridgeService bridge;

    public VoteRewardListener(ZanderAddonMain plugin, BridgeService bridge) {
        this.plugin = plugin;
        this.bridge = bridge;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        final Player player = event.getPlayer();
        final String uuid = player.getUniqueId().toString();
        final String name = player.getName();

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            final List<RewardCommand> claimed;
            try {
                claimed = bridge.claimRewardCommands(uuid, name);
            } catch (Exception e) {
                plugin.getLogger().warning("[bridge] vote-reward claim failed for " + name + ": " + e.getMessage());
                return;
            }
            if (claimed.isEmpty()) return;

            Bukkit.getScheduler().runTask(plugin, () -> {
                final List<Long> done = new ArrayList<>();
                final Map<Long, String> failed = new HashMap<>();

                for (RewardCommand rc : claimed) {
                    try {
                        boolean asPlayer = rc.executeAs != null
                                && (rc.executeAs.equalsIgnoreCase("player") || rc.executeAs.equalsIgnoreCase("self"));

                        if (asPlayer) {
                            if (!player.isOnline()) {
                                failed.put(rc.id, "player left before command could run");
                                continue;
                            }
                            Bukkit.dispatchCommand(player, stripSlash(rc.command));
                        } else {
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), stripSlash(rc.command));
                        }
                        done.add(rc.id);
                    } catch (Exception ex) {
                        failed.put(rc.id, ex.getClass().getSimpleName() + ": " + ex.getMessage());
                        plugin.getLogger().warning("[bridge] vote-reward command " + rc.id + " failed: " + ex.getMessage());
                    }
                }

                Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
                    try {
                        bridge.completeRewardCommands(uuid, done);
                    } catch (Exception e) {
                        plugin.getLogger().warning("[bridge] vote-reward complete report failed for " + name + ": " + e.getMessage());
                    }
                    if (!failed.isEmpty()) {
                        try {
                            bridge.failRewardCommands(uuid, failed);
                        } catch (Exception e) {
                            plugin.getLogger().warning("[bridge] vote-reward fail report failed for " + name + ": " + e.getMessage());
                        }
                    }
                });
            });
        });
    }

    private static String stripSlash(String command) {
        return command != null && command.startsWith("/") ? command.substring(1) : command;
    }
}
