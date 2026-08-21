package dev.anchorlight.zander.addon.navigation;

import dev.anchorlight.zander.addon.shop.ShopDirectoryConfig;
import dev.anchorlight.zander.addon.shop.ShopDirectoryEntry;
import dev.anchorlight.zander.addon.shop.ShopDirectoryService;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class ShopNavigationService {

    private final Plugin plugin;
    private final ShopDirectoryConfig config;
    private final ShopDirectoryService directoryService;
    private final Map<UUID, ShopNavigationSession> sessions = new ConcurrentHashMap<>();
    private BukkitTask tickTask;

    public ShopNavigationService(Plugin plugin, ShopDirectoryConfig config, ShopDirectoryService directoryService) {
        this.plugin = plugin;
        this.config = config;
        this.directoryService = directoryService;
    }

    public void start() {
        if (!config.navigationEnabled()) {
            return;
        }
        this.tickTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, config.updateIntervalTicks(), config.updateIntervalTicks());
    }

    public void stop() {
        if (tickTask != null) {
            tickTask.cancel();
            tickTask = null;
        }
        sessions.keySet().forEach(id -> cancel(id, false));
        sessions.clear();
    }

    public void start(Player player, ShopDirectoryEntry target) {
        cancel(player.getUniqueId(), false);

        ShopNavigationSession session = new ShopNavigationSession(player.getUniqueId(), target);
        if (config.compass()) {
            // Paper 1.21.11's Player interface exposes only getCompassTarget()/setCompassTarget(Location);
            // there is no isCompassTargetOverridden()-style accessor. getCompassTarget() always returns a
            // Location (the player's world spawn if never overridden), so we simply snapshot whatever it
            // currently returns and always restore it on cleanup.
            session.capturePreviousCompass(true, player.getCompassTarget());
            player.setCompassTarget(target.location());
        }
        sessions.put(player.getUniqueId(), session);
    }

    public void cancel(UUID playerId) {
        cancel(playerId, true);
    }

    private void cancel(UUID playerId, boolean notifyPlayer) {
        ShopNavigationSession session = sessions.remove(playerId);
        if (session == null) {
            return;
        }
        Player player = Bukkit.getPlayer(playerId);
        if (player != null && config.compass() && session.previousCompassWasCustom() && session.previousCompassTarget() != null) {
            player.setCompassTarget(session.previousCompassTarget());
        }
        if (player != null && notifyPlayer) {
            player.sendMessage(Component.text("Navigation stopped.", NamedTextColor.YELLOW));
        }
    }

    public void cleanupOnQuit(UUID playerId) {
        sessions.remove(playerId);
    }

    public Optional<ShopNavigationSession> activeSession(UUID playerId) {
        return Optional.ofNullable(sessions.get(playerId));
    }

    private void tick() {
        for (ShopNavigationSession session : sessions.values()) {
            Player player = Bukkit.getPlayer(session.playerId());
            if (player == null) {
                sessions.remove(session.playerId());
                continue;
            }

            Optional<ShopDirectoryEntry> stillValid = directoryService.resolve(session.shopId());
            if (stillValid.isEmpty()) {
                player.sendMessage(Component.text("The shop you were navigating to is no longer available.", NamedTextColor.RED));
                cancel(session.playerId(), false);
                continue;
            }

            if (!player.getWorld().getName().equals(session.location().getWorld().getName())) {
                continue;
            }

            if (session.hasArrived(player.getLocation(), config.arrivalDistance())) {
                player.sendMessage(Component.text("✓ You've arrived at " + session.ownerDisplayName() + "'s "
                        + session.itemDisplayName() + " shop!", NamedTextColor.GREEN));
                cancel(session.playerId(), false);
                continue;
            }

            if (config.actionBar()) {
                double distance = session.distanceTo(player.getLocation());
                player.sendActionBar(Component.text("🧭 " + session.itemDisplayName() + " • "
                        + session.ownerDisplayName() + " • " + Math.round(distance) + " blocks", NamedTextColor.AQUA));
            }
        }
    }
}
