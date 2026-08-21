package dev.anchorlight.zander.addon.shop;

import com.ghostchu.quickshop.api.QuickShopAPI;
import com.ghostchu.quickshop.api.QuickShopProvider;
import com.ghostchu.quickshop.api.event.Phase;
import com.ghostchu.quickshop.api.event.economy.ShopSuccessPurchaseEvent;
import com.ghostchu.quickshop.api.event.inventory.ShopInventoryChangedEvent;
import com.ghostchu.quickshop.api.event.management.ShopCreateEvent;
import com.ghostchu.quickshop.api.event.management.ShopDeleteEvent;
import com.ghostchu.quickshop.api.event.settings.type.ShopOwnerEvent;
import com.ghostchu.quickshop.api.event.settings.type.ShopPriceEvent;
import com.ghostchu.quickshop.api.event.settings.type.ShopTypeEnhancedEvent;
import com.ghostchu.quickshop.api.obj.QUser;
import com.ghostchu.quickshop.api.shop.IShopType;
import com.ghostchu.quickshop.api.shop.Shop;
import com.ghostchu.quickshop.api.shop.ShopManager;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.Plugin;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * The sole boundary between the Shop Directory feature and the QuickShop-Hikari API.
 *
 * <p>No other class in this feature may import {@code com.ghostchu.quickshop.api.*}. Everything
 * crossing this boundary is already converted to {@link ShopDirectoryEntry} or plain Java types,
 * so a future QuickShop API break is a one-file fix.
 *
 * <p><b>Verified API surface</b> (QuickShop-Hikari {@code com.ghostchu:quickshop-bukkit:6.3.0.0}
 * classifier {@code shaded}; inspected with {@code jar tf} + {@code javap} against the jar in the
 * local Maven repository — the API classes are present unrelocated under
 * {@code com/ghostchu/quickshop/api/}):
 * <ul>
 *   <li>Entry point: {@code com.ghostchu.quickshop.api.QuickShopProvider} — the QuickShop
 *       {@link Plugin} instance implements it; {@code getApiInstance()} returns
 *       {@code com.ghostchu.quickshop.api.QuickShopAPI}. {@code QuickShopAPI.getInstance()} exists
 *       as a static fallback.</li>
 *   <li>Shop registry: {@code QuickShopAPI#getShopManager()} →
 *       {@code com.ghostchu.quickshop.api.shop.ShopManager}, with
 *       {@code List<Shop> getAllShops()}, {@code List<Shop> getShopsInWorld(String)} and
 *       {@code Shop getShop(long)}.</li>
 *   <li>Shop type: {@code com.ghostchu.quickshop.api.shop.Shop<U, L>} (generic; used raw here).
 *       Accessors come from its supertypes:
 *       <ul>
 *         <li>{@code ShopMeta#getShopId()} → {@code long} (persistent database id)</li>
 *         <li>{@code ShopMeta#getItem()} → {@link ItemStack}</li>
 *         <li>{@code ShopMeta#getPrice()} → {@code double}</li>
 *         <li>{@code ShopMeta#getOwner()} → {@code com.ghostchu.quickshop.api.obj.QUser}
 *             ({@code getUniqueId()}, {@code getUsername()}, {@code getDisplay()})</li>
 *         <li>{@code ShopMeta#shopType()} → {@code com.ghostchu.quickshop.api.shop.IShopType}
 *             with {@code isBuying()} and {@code remainingStock(Shop)}</li>
 *         <li>{@code ShopMeta#isUnlimited()}, {@code Shop#isValid()}</li>
 *         <li>{@code Locatable#bukkitLocation()} → {@link Location}</li>
 *         <li>{@code ShopInventory#getRemainingStock()} → {@code int}</li>
 *       </ul>
 *   </li>
 *   <li>Events (all extend {@code com.ghostchu.quickshop.api.event.AbstractQSEvent}, a Bukkit
 *       {@code Event}; the phased ones additionally extend {@code PhasedEvent} and fire once per
 *       {@code com.ghostchu.quickshop.api.event.Phase} — PRE / PRE_CANCELLABLE / MAIN / POST /
 *       RETRIEVE — so this class only reacts to {@code Phase.POST}):
 *       <ul>
 *         <li>{@code event.management.ShopCreateEvent} (phased)</li>
 *         <li>{@code event.management.ShopDeleteEvent} (phased)</li>
 *         <li>{@code event.settings.type.ShopPriceEvent} (phased)</li>
 *         <li>{@code event.settings.type.ShopOwnerEvent} (phased)</li>
 *         <li>{@code event.settings.type.ShopTypeEnhancedEvent} (phased)</li>
 *         <li>{@code event.economy.ShopSuccessPurchaseEvent} (not phased — stock-affecting)</li>
 *         <li>{@code event.inventory.ShopInventoryChangedEvent} (not phased — stock-affecting)</li>
 *       </ul>
 *   </li>
 * </ul>
 *
 * <p>All methods here do main-thread Bukkit/QuickShop work and must only ever be called from the
 * main server thread; callers are responsible for enforcing that.
 */
public final class QuickShopIntegration {

    private static final String UNKNOWN_OWNER = "Unknown";

    private final Plugin quickShopPlugin;
    private final Plugin owningPlugin;
    private final Logger logger;
    private final QuickShopAPI api;

    private Listener changeListener;

    private QuickShopIntegration(Plugin quickShopPlugin, Plugin owningPlugin, Logger logger, QuickShopAPI api) {
        this.quickShopPlugin = quickShopPlugin;
        this.owningPlugin = owningPlugin;
        this.logger = logger;
        this.api = api;
    }

    /**
     * Attempts to bind to the running QuickShop-Hikari instance. Returns empty if the plugin does
     * not expose a usable API (wrong version, disabled, relocated classes, ...). Never throws.
     *
     * @param quickShopPlugin the running QuickShop-Hikari plugin instance to bind to
     * @param owningPlugin    Zander's own plugin instance; the {@link #registerChangeListener}
     *                        listener is registered under this plugin (not {@code quickShopPlugin})
     *                        so that QuickShop reloading/disabling independently of Zander does not
     *                        silently tear down the listener along with it.
     */
    public static Optional<QuickShopIntegration> tryInitialize(Plugin quickShopPlugin, Plugin owningPlugin, Logger logger) {
        // Throwable, not Exception: a version mismatch surfaces as NoSuchMethodError /
        // NoClassDefFoundError (Errors), which must never abort Zander's onEnable.
        try {
            if (quickShopPlugin == null || !quickShopPlugin.isEnabled()) {
                return Optional.empty();
            }
            QuickShopAPI api = null;
            if (quickShopPlugin instanceof QuickShopProvider provider) {
                api = provider.getApiInstance();
            }
            if (api == null) {
                api = QuickShopAPI.getInstance();
            }
            if (api == null || api.getShopManager() == null) {
                logger.warning("[ShopDirectory] QuickShop-Hikari is present but exposed no usable API instance.");
                return Optional.empty();
            }
            return Optional.of(new QuickShopIntegration(quickShopPlugin, owningPlugin, logger, api));
        } catch (Throwable t) {
            logger.warning("[ShopDirectory] Failed to initialize QuickShop-Hikari integration: " + t);
            return Optional.empty();
        }
    }

    /**
     * Full enumeration of every shop, restricted to {@code allowedWorlds} (empty/null means all
     * worlds). Expensive — intended only for the initial index build and the periodic safety
     * refresh, never per player command.
     */
    public List<ShopDirectoryEntry> snapshotAllShops(Collection<String> allowedWorlds) {
        List<ShopDirectoryEntry> entries = new ArrayList<>();
        try {
            ShopManager shopManager = api.getShopManager();
            List<Shop> shops = shopManager.getAllShops();
            if (shops == null) {
                return entries;
            }
            boolean filterWorlds = allowedWorlds != null && !allowedWorlds.isEmpty();
            for (Shop shop : shops) {
                ShopDirectoryEntry entry = toEntry(shop);
                if (entry == null) {
                    continue;
                }
                if (filterWorlds && !allowedWorlds.contains(entry.world())) {
                    continue;
                }
                entries.add(entry);
            }
        } catch (Throwable t) {
            logger.log(Level.WARNING, "[ShopDirectory] Failed to snapshot QuickShop shops", t);
        }
        return entries;
    }

    /**
     * Re-resolves a single shop straight from QuickShop. Returns empty if the id is unparseable or
     * the shop has been deleted/invalidated since the index was built.
     */
    public Optional<ShopDirectoryEntry> resolve(String shopId) {
        if (shopId == null || shopId.isBlank()) {
            return Optional.empty();
        }
        try {
            long id = Long.parseLong(shopId.trim());
            Shop shop = api.getShopManager().getShop(id);
            if (shop == null) {
                return Optional.empty();
            }
            return Optional.ofNullable(toEntry(shop));
        } catch (NumberFormatException e) {
            return Optional.empty();
        } catch (Throwable t) {
            logger.log(Level.WARNING, "[ShopDirectory] Failed to resolve shop " + shopId, t);
            return Optional.empty();
        }
    }

    /**
     * Registers Bukkit listeners for QuickShop's shop create/delete/price/owner/type change and
     * stock-affecting events, invoking {@code onRelevantChange} on the main thread each time one
     * fires. Calling this twice replaces the previous registration.
     */
    public void registerChangeListener(Runnable onRelevantChange) {
        if (onRelevantChange == null) {
            return;
        }
        unregister();
        try {
            ChangeListener listener = new ChangeListener(onRelevantChange);
            Bukkit.getPluginManager().registerEvents(listener, owningPlugin());
            this.changeListener = listener;
        } catch (Throwable t) {
            logger.log(Level.WARNING, "[ShopDirectory] Failed to register QuickShop change listeners", t);
        }
    }

    /** Unregisters any listener registered by {@link #registerChangeListener(Runnable)}. */
    public void unregister() {
        if (changeListener == null) {
            return;
        }
        try {
            HandlerList.unregisterAll(changeListener);
        } catch (Throwable t) {
            logger.log(Level.WARNING, "[ShopDirectory] Failed to unregister QuickShop change listeners", t);
        } finally {
            changeListener = null;
        }
    }

    // --- internals: everything below converts QuickShop types into plain types -------------------

    private Plugin owningPlugin() {
        // Listeners belong to Zander's own plugin instance (not the QuickShop plugin) so that
        // QuickShop reloading/disabling independently of Zander does not tear the listener down
        // with it. HandlerList.unregisterAll(listener) still removes exactly our handlers.
        return owningPlugin;
    }

    private ShopDirectoryEntry toEntry(Shop shop) {
        try {
            if (shop == null || !shop.isValid()) {
                return null;
            }
            Location location = shop.bukkitLocation();
            if (location == null || location.getWorld() == null) {
                return null;
            }
            ItemStack item = shop.getItem();
            Material material = item == null ? Material.AIR : item.getType();

            IShopType type = shop.shopType();
            ShopDirectoryEntry.ShopKind kind = (type != null && type.isBuying())
                    ? ShopDirectoryEntry.ShopKind.BUYING
                    : ShopDirectoryEntry.ShopKind.SELLING;

            UUID ownerUuid = ownerUuid(shop);

            return new ShopDirectoryEntry(
                    String.valueOf(shop.getShopId()),
                    material,
                    itemDisplayName(item, material),
                    ownerUuid,
                    ownerDisplayName(shop, ownerUuid),
                    // getPrice() is @Deprecated(forRemoval) in 6.3.0.0 in favour of the generic
                    // ShopPrice#price(), which returns U (Object on a raw Shop) and would need an
                    // unchecked cast. Keeping the double-typed accessor while it exists.
                    shop.getPrice(),
                    kind,
                    stockOf(shop),
                    location.getWorld().getName(),
                    location
            );
        } catch (Throwable t) {
            logger.log(Level.FINE, "[ShopDirectory] Skipping unreadable QuickShop shop", t);
            return null;
        }
    }

    private UUID ownerUuid(Shop shop) {
        try {
            QUser owner = shop.getOwner();
            return owner == null ? null : owner.getUniqueId();
        } catch (Throwable t) {
            return null;
        }
    }

    /**
     * Resolves an owner name without ever hitting the network: only the local offline-player cache
     * is consulted, then QuickShop's cached username, then a literal fallback.
     */
    private String ownerDisplayName(Shop shop, UUID ownerUuid) {
        try {
            if (ownerUuid != null) {
                String name = Bukkit.getOfflinePlayer(ownerUuid).getName();
                if (name != null && !name.isBlank()) {
                    return name;
                }
            }
            QUser owner = shop.getOwner();
            if (owner != null) {
                String username = owner.getUsername();
                if (username != null && !username.isBlank()) {
                    return username;
                }
                String display = owner.getDisplay();
                if (display != null && !display.isBlank()) {
                    return display;
                }
            }
        } catch (Throwable t) {
            // fall through to the constant below
        }
        return UNKNOWN_OWNER;
    }

    /**
     * Stock via QuickShop's own type-aware accessor. Unlimited shops report
     * {@link Integer#MAX_VALUE}. If the read fails (unusual container, chunk unloaded, custom
     * inventory provider), this returns 0 rather than propagating — meaning such shops look
     * out-of-stock in the directory instead of breaking the whole snapshot.
     */
    private int stockOf(Shop shop) {
        try {
            if (shop.isUnlimited()) {
                return Integer.MAX_VALUE;
            }
            IShopType type = shop.shopType();
            if (type != null) {
                Integer typed = type.remainingStock(shop);
                if (typed != null) {
                    return Math.max(0, typed);
                }
            }
            return Math.max(0, shop.getRemainingStock());
        } catch (Throwable t) {
            return 0;
        }
    }

    private String itemDisplayName(ItemStack item, Material material) {
        try {
            if (item != null && item.hasItemMeta()) {
                ItemMeta meta = item.getItemMeta();
                if (meta != null && meta.hasDisplayName()) {
                    String plain = PlainTextComponentSerializer.plainText().serialize(meta.displayName());
                    if (plain != null && !plain.isBlank()) {
                        return plain;
                    }
                }
            }
        } catch (Throwable t) {
            // fall through to the prettified material name
        }
        return prettify(material);
    }

    private static String prettify(Material material) {
        String[] words = material.name().toLowerCase(Locale.ROOT).split("_");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (word.isEmpty()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(word.charAt(0))).append(word, 1, word.length());
        }
        return sb.toString();
    }

    /**
     * Bukkit listener bridging QuickShop's events to a single plain {@link Runnable}. Phased events
     * are filtered to {@link Phase#POST} so the callback sees committed state exactly once.
     */
    private final class ChangeListener implements Listener {

        private final Runnable callback;

        private ChangeListener(Runnable callback) {
            this.callback = callback;
        }

        @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
        public void onShopCreate(ShopCreateEvent event) {
            fireIfPost(event.phase());
        }

        @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
        public void onShopDelete(ShopDeleteEvent event) {
            fireIfPost(event.phase());
        }

        @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
        public void onShopPrice(ShopPriceEvent event) {
            fireIfPost(event.phase());
        }

        @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
        public void onShopOwner(ShopOwnerEvent event) {
            fireIfPost(event.phase());
        }

        @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
        public void onShopType(ShopTypeEnhancedEvent event) {
            fireIfPost(event.phase());
        }

        @EventHandler(priority = EventPriority.MONITOR)
        public void onShopPurchase(ShopSuccessPurchaseEvent event) {
            fire();
        }

        @EventHandler(priority = EventPriority.MONITOR)
        public void onShopInventoryChanged(ShopInventoryChangedEvent event) {
            fire();
        }

        private void fireIfPost(Phase phase) {
            if (phase == Phase.POST) {
                fire();
            }
        }

        private void fire() {
            try {
                if (Bukkit.isPrimaryThread()) {
                    callback.run();
                } else {
                    Bukkit.getScheduler().runTask(owningPlugin(), callback);
                }
            } catch (Throwable t) {
                logger.log(Level.WARNING, "[ShopDirectory] QuickShop change callback failed", t);
            }
        }
    }
}
