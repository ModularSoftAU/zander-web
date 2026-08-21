package dev.anchorlight.zander.addon.shop;

import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Owns the lifecycle of the Shop Directory's in-memory index: detecting QuickShop-Hikari,
 * building/refreshing the index, and exposing thread-safe reads of the current snapshot.
 *
 * <p>All work here is deliberately main-thread only (unlike {@code BridgeService}'s
 * {@code runTaskTimerAsynchronously} pattern): every touched object is a live Bukkit/QuickShop
 * object that requires main-thread access (see {@code QuickShopIntegration}'s class doc, §26).
 * The change-listener callback and the periodic refresh task are both scheduled with
 * {@code runTask}/{@code runTaskTimer}, never the async variants.
 */
public class ShopDirectoryService {

    private final Plugin plugin;
    private final ShopDirectoryConfig config;
    private QuickShopIntegration integration;
    private BukkitTask refreshTask;
    private BukkitTask debounceTask;
    private final AtomicReference<List<ShopDirectoryEntry>> index = new AtomicReference<>(List.of());

    // Set by the (possibly high-frequency) QuickShop change-listener callback; cleared and acted
    // on by a lightweight once-per-tick task. This coalesces bursts of QuickShop events (a busy
    // server can fire several per second) into at most one full index rebuild per tick, instead of
    // rebuilding synchronously and unconditionally on every single event (see §25: never scan every
    // shop on every trigger).
    private final AtomicBoolean dirty = new AtomicBoolean(false);

    public ShopDirectoryService(Plugin plugin, ShopDirectoryConfig config) {
        this.plugin = plugin;
        this.config = config;
    }

    public boolean start() {
        var quickShopPlugin = Bukkit.getPluginManager().getPlugin("QuickShop-Hikari");
        if (quickShopPlugin == null || !quickShopPlugin.isEnabled()) {
            plugin.getLogger().warning("[ShopDirectory] Shop Directory is enabled but QuickShop-Hikari was not found.");
            plugin.getLogger().warning("[ShopDirectory] Shop Directory has been disabled for this session.");
            return false;
        }

        Optional<QuickShopIntegration> initialized = QuickShopIntegration.tryInitialize(quickShopPlugin, plugin, plugin.getLogger());
        if (initialized.isEmpty()) {
            plugin.getLogger().warning("[ShopDirectory] Shop Directory is enabled but QuickShop-Hikari was not found.");
            plugin.getLogger().warning("[ShopDirectory] Shop Directory has been disabled for this session.");
            return false;
        }

        this.integration = initialized.get();
        rebuildIndex();

        // Cheap callback: just raise the dirty flag. The actual (expensive) rebuild happens at
        // most once per tick via debounceTask below.
        integration.registerChangeListener(() -> dirty.set(true));

        long debounceIntervalTicks = 1L; // coalesce all changes within a tick into one rebuild
        this.debounceTask = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (dirty.compareAndSet(true, false)) {
                rebuildIndex();
            }
        }, debounceIntervalTicks, debounceIntervalTicks);

        long refreshIntervalTicks = 20L * 60L * 10L; // 10-minute safety-net refresh, always rebuilds
        this.refreshTask = Bukkit.getScheduler().runTaskTimer(plugin, this::rebuildIndex, refreshIntervalTicks, refreshIntervalTicks);

        plugin.getLogger().info("[ShopDirectory] Connected to QuickShop-Hikari.");
        plugin.getLogger().info("[ShopDirectory] Shop Directory indexed " + index.get().size() + " shops.");
        plugin.getLogger().info("[ShopDirectory] Shop Directory enabled.");
        return true;
    }

    public void stop() {
        if (refreshTask != null) {
            refreshTask.cancel();
            refreshTask = null;
        }
        if (debounceTask != null) {
            debounceTask.cancel();
            debounceTask = null;
        }
        dirty.set(false);
        if (integration != null) {
            integration.unregister();
            integration = null;
        }
    }

    private void rebuildIndex() {
        if (integration == null) {
            return;
        }
        try {
            index.set(integration.snapshotAllShops(config.worlds()));
        } catch (Throwable t) {
            plugin.getLogger().warning("[ShopDirectory] Failed to refresh shop index: " + t.getMessage());
        }
    }

    public List<ShopDirectoryEntry> currentIndex() {
        return index.get();
    }

    public Optional<ShopDirectoryEntry> resolve(String shopId) {
        if (integration == null) {
            return Optional.empty();
        }
        try {
            return integration.resolve(shopId);
        } catch (Throwable t) {
            plugin.getLogger().warning("[ShopDirectory] Failed to resolve shop " + shopId + ": " + t.getMessage());
            return Optional.empty();
        }
    }
}
