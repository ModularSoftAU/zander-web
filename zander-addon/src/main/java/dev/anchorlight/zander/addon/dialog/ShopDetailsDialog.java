package dev.anchorlight.zander.addon.dialog;

import dev.anchorlight.zander.addon.navigation.ShopNavigationService;
import dev.anchorlight.zander.addon.shop.ShopDirectoryEntry;
import dev.anchorlight.zander.addon.shop.ShopDirectoryService;
import io.papermc.paper.dialog.Dialog;
import io.papermc.paper.registry.data.dialog.ActionButton;
import io.papermc.paper.registry.data.dialog.DialogBase;
import io.papermc.paper.registry.data.dialog.action.DialogAction;
import io.papermc.paper.registry.data.dialog.action.DialogActionCallback;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import io.papermc.paper.registry.data.dialog.type.DialogType;
import net.kyori.adventure.audience.Audience;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickCallback;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;

/**
 * Single-shop details dialog, opened from {@link ShopSearchResultsDialog} when a player
 * clicks "View" on a search result. Offers a "Guide Me" navigation button (same-world only)
 * and a "Back to Results" button.
 *
 * <p>This class never touches QuickShop types directly; everything it needs comes
 * from {@link ShopDirectoryEntry} / {@link ShopDirectoryService} / {@link ShopNavigationService}.</p>
 */
public class ShopDetailsDialog {

    private static final ClickCallback.Options CLICK_OPTIONS = ClickCallback.Options.builder()
            .uses(ClickCallback.UNLIMITED_USES)
            .lifetime(Duration.ofMinutes(10))
            .build();

    private final Plugin plugin;
    private final ShopDirectoryService directoryService;
    private final ShopNavigationService navigationService;
    private final ShopSearchResultsDialog resultsDialog;
    private final ShopDirectoryDialog rootDialog;

    public ShopDetailsDialog(Plugin plugin,
                              ShopDirectoryService directoryService,
                              ShopNavigationService navigationService,
                              ShopSearchResultsDialog resultsDialog,
                              ShopDirectoryDialog rootDialog) {
        this.plugin = plugin;
        this.directoryService = directoryService;
        this.navigationService = navigationService;
        this.resultsDialog = resultsDialog;
        this.rootDialog = rootDialog;
    }

    /**
     * Builds and shows the details dialog for {@code shopId}. Always re-resolves the shop via
     * {@link ShopDirectoryService#resolve(String)} first (§4/§13) — a shop's price/stock/owner
     * can change or the shop can be deleted between when a search result was shown and when the
     * player clicks into details, so a stale passed-in entry is never trusted directly. Never
     * throws; on any failure the player gets a plain chat message and the cause is logged.
     */
    public void open(Player player, String shopId) {
        try {
            Optional<ShopDirectoryEntry> resolved = directoryService.resolve(shopId);
            if (resolved.isEmpty()) {
                player.sendMessage(Component.text("That shop is no longer available.", NamedTextColor.RED));
                // Fall back to the root directory dialog rather than resetting the player's
                // in-progress search/filter to an unfiltered, page-0 "browse all" view.
                rootDialog.open(player);
                return;
            }
            player.showDialog(buildDialog(resolved.get(), player));
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open shop details.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Details dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildDialog(ShopDirectoryEntry entry, Player player) {
        List<DialogBody> body = new ArrayList<>();
        List<ActionButton> buttons = new ArrayList<>();

        boolean sameWorld = entry.world().equals(player.getWorld().getName());

        body.add(DialogBody.plainMessage(Component.text(entry.itemDisplayName())));
        body.add(DialogBody.plainMessage(Component.text(
                "Seller: " + entry.ownerDisplayName(), NamedTextColor.GRAY)));
        body.add(DialogBody.plainMessage(Component.text(
                "Price: " + formatPrice(entry.price()), NamedTextColor.GRAY)));
        body.add(DialogBody.plainMessage(Component.text(
                "Stock: " + formatStock(entry.stock()), NamedTextColor.GRAY)));

        if (sameWorld) {
            body.add(DialogBody.plainMessage(Component.text(
                    "Distance: " + distanceLabel(entry, player.getLocation()), NamedTextColor.GRAY)));
        } else {
            body.add(DialogBody.plainMessage(Component.text(
                    "This shop is in the " + entry.world() + " world.\nTravel there before starting navigation.",
                    NamedTextColor.YELLOW)));
        }

        body.add(DialogBody.plainMessage(Component.text(
                "World: " + entry.world(), NamedTextColor.GRAY)));
        body.add(DialogBody.plainMessage(Component.text(
                "Location: " + coordinatesLabel(entry.location()), NamedTextColor.GRAY)));

        if (sameWorld) {
            buttons.add(button("Guide Me", "Start navigation to this shop",
                    (response, audience) -> onMainThread(audience, p -> startGuide(p, entry))));
        }

        buttons.add(button("Back to Results", "Return to the shop directory",
                (response, audience) -> onMainThread(audience,
                        p -> rootDialog.open(p))));

        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Shop Details"))
                        .body(body)
                        .canCloseWithEscape(true)
                        .build())
                .type(DialogType.multiAction(buttons).columns(1).build()));
    }

    private static ActionButton button(String label, String tooltip, DialogActionCallback callback) {
        return ActionButton.builder(Component.text(label))
                .tooltip(Component.text(tooltip))
                .action(DialogAction.customClick(callback, CLICK_OPTIONS))
                .build();
    }

    // ---------------------------------------------------------------- helpers

    private void startGuide(Player player, ShopDirectoryEntry entry) {
        navigationService.start(player, entry);
        player.sendMessage(Component.text(
                "Navigating to " + entry.itemDisplayName() + ".", NamedTextColor.GREEN));
    }

    /**
     * Duplicated from {@link ShopSearchResultsDialog#formatPrice(double)}. With only two call
     * sites this small static method is acceptable to duplicate per YAGNI rather than
     * prematurely extracting a shared utility class.
     */
    private static String formatPrice(double price) {
        if (price == Math.floor(price)) {
            return String.format("$%,.0f", price);
        }
        return String.format("$%,.2f", price);
    }

    /**
     * Duplicated from {@link ShopSearchResultsDialog#formatStock(int)} — same "Unlimited"
     * special-case for the {@code Integer.MAX_VALUE} sentinel.
     */
    private static String formatStock(int stock) {
        if (stock >= Integer.MAX_VALUE - 1 || stock < 0) {
            return "Unlimited";
        }
        return String.valueOf(stock);
    }

    /**
     * Distance to the shop, or {@code "?"} when it cannot be computed (different world —
     * {@link Location#distance(Location)} throws {@link IllegalArgumentException}).
     */
    private static String distanceLabel(ShopDirectoryEntry entry, Location viewerLocation) {
        try {
            return Math.round(viewerLocation.distance(entry.location())) + " blocks";
        } catch (Throwable t) {
            return "?";
        }
    }

    private static String coordinatesLabel(Location location) {
        return Math.round(location.getX()) + ", " + Math.round(location.getY()) + ", " + Math.round(location.getZ());
    }

    /**
     * Dialog callback threading is not documented in the Paper API, so every handler that
     * touches Bukkit or the shop services is dispatched onto the main thread explicitly.
     * Already-main-thread callbacks run inline so behaviour stays synchronous where possible.
     */
    private void onMainThread(Audience audience, PlayerAction action) {
        try {
            if (!(audience instanceof Player player)) {
                return;
            }
            Runnable body = () -> {
                try {
                    if (player.isOnline()) {
                        action.run(player);
                    }
                } catch (Throwable t) {
                    plugin.getLogger().log(Level.WARNING,
                            "Shop Details dialog action failed for " + player.getName(), t);
                    try {
                        player.sendMessage(Component.text("Something went wrong.", NamedTextColor.RED));
                    } catch (Throwable ignored) {
                        // player may be gone; nothing more to do
                    }
                }
            };
            if (Bukkit.isPrimaryThread()) {
                body.run();
            } else {
                Bukkit.getScheduler().runTask(plugin, body);
            }
        } catch (Throwable t) {
            plugin.getLogger().log(Level.WARNING, "Failed to dispatch Shop Details dialog action", t);
            if (audience instanceof Player player) {
                try {
                    player.sendMessage(Component.text("Something went wrong.", NamedTextColor.RED));
                } catch (Throwable ignored) {
                    // player may be gone; nothing more to do
                }
            }
        }
    }

    @FunctionalInterface
    private interface PlayerAction {
        void run(Player player);
    }
}
