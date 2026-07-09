package org.modularsoft.zander.pgm.tracker;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.modularsoft.zander.pgm.ZanderPGMPlugin;
import org.modularsoft.zander.pgm.stats.PlayerStats;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks per-player session time and drives rank/entitlement sync on join.
 * Accumulates {@link PlayerStats#playtimeSeconds} on quit.
 */
public class SessionTracker implements Listener {

    private final ZanderPGMPlugin plugin;
    private final ConcurrentHashMap<UUID, Long> joinTimes = new ConcurrentHashMap<>();

    public SessionTracker(ZanderPGMPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        joinTimes.put(p.getUniqueId(), System.currentTimeMillis());
        plugin.tokens().refreshKnownUsername(p.getUniqueId(), p.getName());
        // Sync rank / entitlements asynchronously.
        plugin.ranks().syncPlayer(p.getUniqueId());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player p = event.getPlayer();
        Long joined = joinTimes.remove(p.getUniqueId());
        if (joined != null && plugin.cfg().includeSessionStats) {
            long seconds = (System.currentTimeMillis() - joined) / 1000L;
            PlayerStats stats = plugin.stats().peek(p.getUniqueId());
            if (stats != null) {
                stats.playtimeSeconds += seconds;
            }
        }
        plugin.entitlements().clear(p.getUniqueId());
    }
}
