package dev.anchorlight.zander.addon.dialog;

import dev.anchorlight.zander.addon.shop.ShopDirectoryConfig;
import dev.anchorlight.zander.addon.shop.ShopDirectoryEntry;
import dev.anchorlight.zander.addon.shop.ShopDirectoryService;
import dev.anchorlight.zander.addon.shop.ShopSearchService;
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
import java.util.logging.Level;

/**
 * Paginated shop search results, opened from {@link ShopDirectoryDialog}.
 *
 * <p>This class never touches QuickShop types directly; everything it needs comes
 * from {@link ShopDirectoryEntry} / {@link ShopDirectoryService} / {@link ShopSearchService}.</p>
 */
public class ShopSearchResultsDialog {

    private static final ClickCallback.Options CLICK_OPTIONS = ClickCallback.Options.builder()
            .uses(ClickCallback.UNLIMITED_USES)
            .lifetime(Duration.ofMinutes(10))
            .build();

    private final Plugin plugin;
    private final ShopDirectoryService directoryService;
    private final ShopDirectoryConfig config;
    private final ShopDirectoryDialog rootDialog;

    /**
     * Opens {@code ShopDetailsDialog} for a given shop. Task 11 creates that class; Task 13
     * wires it in via {@link #setDetailsOpener(DetailsOpener)} — typically
     * {@code resultsDialog.setDetailsOpener(detailsDialog::open)}. Using a functional interface
     * rather than a direct field type avoids a compile-time forward reference to a not-yet-existent
     * class, matching the idiom {@code ShopDirectoryDialog} used for this class in Task 9.
     */
    @FunctionalInterface
    public interface DetailsOpener {
        void open(Player player, String shopId);
    }

    private DetailsOpener detailsOpener;

    public ShopSearchResultsDialog(Plugin plugin,
                                    ShopDirectoryService directoryService,
                                    ShopDirectoryConfig config,
                                    ShopDirectoryDialog rootDialog) {
        this.plugin = plugin;
        this.directoryService = directoryService;
        this.config = config;
        this.rootDialog = rootDialog;
    }

    /** Wired by Task 13 once {@code ShopDetailsDialog} exists. */
    public void setDetailsOpener(DetailsOpener detailsOpener) {
        this.detailsOpener = detailsOpener;
    }

    /**
     * Builds and shows the results dialog for {@code page} (0-based, clamped) of results
     * matching {@code query}. Never throws; on any failure the player gets a plain chat
     * message and the cause is logged.
     */
    public void open(Player player, String query, int page) {
        try {
            List<ShopDirectoryEntry> results = ShopSearchService.search(
                    directoryService.currentIndex(), query, config,
                    player.getLocation(), player.getWorld().getName());

            int perPage = Math.max(1, config.resultsPerPage());
            int lastPage = Math.max(0, (results.size() - 1) / perPage);
            int clampedPage = Math.max(0, Math.min(page, lastPage));

            int fromIndex = Math.min(clampedPage * perPage, results.size());
            int toIndex = Math.min(fromIndex + perPage, results.size());
            List<ShopDirectoryEntry> pageResults = results.subList(fromIndex, toIndex);

            player.showDialog(buildDialog(query, clampedPage, lastPage, results.size(), pageResults,
                    player.getLocation()));
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open shop search results.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Search Results dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildDialog(String query, int page, int lastPage, int totalResults,
                                List<ShopDirectoryEntry> pageResults, Location viewerLocation) {
        List<DialogBody> body = new ArrayList<>();
        List<ActionButton> buttons = new ArrayList<>();

        if (totalResults == 0) {
            body.add(DialogBody.plainMessage(Component.text("No shops found.", NamedTextColor.GRAY)));
        } else {
            body.add(DialogBody.plainMessage(Component.text(
                    totalResults + " shop" + (totalResults == 1 ? "" : "s") + " found. Page "
                            + (page + 1) + " of " + (lastPage + 1) + ".", NamedTextColor.GRAY)));

            for (ShopDirectoryEntry entry : pageResults) {
                body.add(DialogBody.plainMessage(Component.text(
                        entry.itemDisplayName() + " — " + formatPrice(entry.price())
                                + " — " + entry.ownerDisplayName()
                                + " — Stock: " + formatStock(entry.stock())
                                + " — " + distanceLabel(entry, viewerLocation))));
                buttons.add(button("View: " + entry.itemDisplayName(), "View shop details",
                        (response, audience) -> onMainThread(audience,
                                p -> openDetails(p, entry.shopId()))));
            }
        }

        if (page > 0) {
            buttons.add(button("Previous", "Go to the previous page",
                    (response, audience) -> onMainThread(audience,
                            p -> open(p, query, page - 1))));
        }
        if (page < lastPage) {
            buttons.add(button("Next", "Go to the next page",
                    (response, audience) -> onMainThread(audience,
                            p -> open(p, query, page + 1))));
        }
        buttons.add(button("Back", "Return to the shop directory",
                (response, audience) -> onMainThread(audience, rootDialog::open)));

        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Shop Search Results"))
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

    private static String formatPrice(double price) {
        if (price == Math.floor(price)) {
            return String.format("$%,.0f", price);
        }
        return String.format("$%,.2f", price);
    }

    /** Never shows a raw {@code Integer.MAX_VALUE} (or similarly huge value) for unlimited-stock shops. */
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

    /**
     * Hands off to {@code ShopDetailsDialog}. If Task 13 has not wired a {@link DetailsOpener}
     * yet, the player is told rather than hitting an NPE.
     */
    private void openDetails(Player player, String shopId) {
        DetailsOpener opener = this.detailsOpener;
        if (opener == null) {
            player.sendMessage(Component.text("Shop details are unavailable right now.", NamedTextColor.RED));
            plugin.getLogger().warning("ShopSearchResultsDialog has no details dialog wired; "
                    + "call setDetailsOpener(...) during startup.");
            return;
        }
        opener.open(player, shopId);
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
                            "Shop Search Results dialog action failed for " + player.getName(), t);
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
            plugin.getLogger().log(Level.WARNING, "Failed to dispatch Shop Search Results dialog action", t);
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
