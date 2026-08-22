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
import io.papermc.paper.registry.data.dialog.input.DialogInput;
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
 * The shop directory itself: a search box plus a paginated, filterable table of results.
 * This is what {@code /shops} shows immediately - there is no separate "search first" screen.
 *
 * <p>This class never touches QuickShop types directly; everything it needs comes
 * from {@link ShopDirectoryEntry} / {@link ShopDirectoryService} / {@link ShopSearchService}.</p>
 */
public class ShopSearchResultsDialog {

    /** Input key for the search text box; read back via {@code DialogResponseView#getText}. */
    static final String INPUT_KEY_QUERY = "query";

    private static final int MAX_QUERY_LENGTH = 64;

    private static final ClickCallback.Options CLICK_OPTIONS = ClickCallback.Options.builder()
            .uses(ClickCallback.UNLIMITED_USES)
            .lifetime(Duration.ofMinutes(10))
            .build();

    private final Plugin plugin;
    private final ShopDirectoryService directoryService;
    private final ShopDirectoryConfig config;

    /**
     * Opens {@code ShopDetailsDialog} for a given shop, passing along the directory state
     * (query/page/filter) the shop was found under so "Back to Results" can return the player
     * to exactly where they were. Wired post-construction via
     * {@link #setDetailsOpener(DetailsOpener)}. Using a functional interface rather than a
     * direct field type avoids a compile-time forward reference to a not-yet-existent class.
     */
    @FunctionalInterface
    public interface DetailsOpener {
        void open(Player player, String shopId, String query, int page, ShopDirectoryEntry.ShopKind kindFilter);
    }

    private DetailsOpener detailsOpener;

    public ShopSearchResultsDialog(Plugin plugin,
                                    ShopDirectoryService directoryService,
                                    ShopDirectoryConfig config) {
        this.plugin = plugin;
        this.directoryService = directoryService;
        this.config = config;
    }

    /** Wired once {@code ShopDetailsDialog} exists. */
    public void setDetailsOpener(DetailsOpener detailsOpener) {
        this.detailsOpener = detailsOpener;
    }

    /**
     * Builds and shows the directory for {@code page} (0-based, clamped) of results
     * matching {@code query}. Never throws; on any failure the player gets a plain chat
     * message and the cause is logged.
     */
    public void open(Player player, String query, int page) {
        open(player, query, page, null);
    }

    /**
     * @param kindFilter when non-null, restricts results to shops of that kind (selling/buying);
     *                   {@code null} shows both, subject to the admin {@code selling-only} setting.
     */
    public void open(Player player, String query, int page, ShopDirectoryEntry.ShopKind kindFilter) {
        try {
            String safeQuery = query == null ? "" : query;
            List<ShopDirectoryEntry> results = ShopSearchService.search(
                    directoryService.currentIndex(), safeQuery, config,
                    player.getLocation(), player.getWorld().getName(), kindFilter);

            int perPage = Math.max(1, config.resultsPerPage());
            int lastPage = Math.max(0, (results.size() - 1) / perPage);
            int clampedPage = Math.max(0, Math.min(page, lastPage));

            int fromIndex = Math.min(clampedPage * perPage, results.size());
            int toIndex = Math.min(fromIndex + perPage, results.size());
            List<ShopDirectoryEntry> pageResults = results.subList(fromIndex, toIndex);

            player.showDialog(buildDialog(safeQuery, clampedPage, lastPage, results.size(), pageResults,
                    player.getLocation(), kindFilter));
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open the shop directory.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Directory dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildDialog(String query, int page, int lastPage, int totalResults,
                                List<ShopDirectoryEntry> pageResults, Location viewerLocation,
                                ShopDirectoryEntry.ShopKind kindFilter) {
        List<DialogBody> body = new ArrayList<>();
        List<ActionButton> buttons = new ArrayList<>();

        if (totalResults == 0) {
            body.add(DialogBody.plainMessage(query.isBlank()
                    ? Component.text("No shops are currently indexed.", NamedTextColor.GRAY)
                    : Component.text("No shops found matching \"" + query + "\".", NamedTextColor.GRAY)));
        } else {
            body.add(DialogBody.plainMessage(Component.text(
                    totalResults + " shop" + (totalResults == 1 ? "" : "s") + " found. Page "
                            + (page + 1) + " of " + (lastPage + 1) + ".", NamedTextColor.GRAY)));
            body.add(DialogBody.plainMessage(Component.text(
                    "Item | Price | Type | Player", NamedTextColor.DARK_GRAY)));

            // A non-interactive divider button (no action) visually separates the search/filter
            // controls above from the clickable shop rows below - Paper Dialogs render body
            // text and buttons in separate sections, so this is the only way to put a visual
            // break between two groups of buttons. Dialog buttons render in a 2-column grid
            // (see columns(2) below), so this - and each shop row - is followed by a blank
            // spacer to keep it on its own full-width line instead of pairing with a neighbor.
            buttons.add(ActionButton.builder(Component.text("- Results -", NamedTextColor.DARK_GRAY)).build());
            buttons.add(spacer());

            for (ShopDirectoryEntry entry : pageResults) {
                NamedTextColor kindColor = entry.kind() == ShopDirectoryEntry.ShopKind.SELLING
                        ? NamedTextColor.GREEN : NamedTextColor.GOLD;
                // Shop owners can rename their item (e.g. an anvil-renamed "d"), so when the
                // display name isn't obviously the material itself, show the real material
                // alongside it - otherwise players can't tell what a cryptically-named row is.
                String materialName = materialName(entry);
                String itemLabel = entry.itemDisplayName().equalsIgnoreCase(materialName)
                        ? entry.itemDisplayName()
                        : entry.itemDisplayName() + " (" + materialName + ")";
                String label = itemLabel + "   " + formatPrice(entry.price())
                        + "   " + kindLabel(entry.kind()) + "   " + entry.ownerDisplayName();
                String tooltip = "Stock: " + formatStock(entry.stock()) + " · "
                        + distanceLabel(entry, viewerLocation) + " · Click to view details";
                buttons.add(ActionButton.builder(Component.text(label, kindColor))
                        .tooltip(Component.text(tooltip))
                        .action(DialogAction.customClick(
                                (response, audience) -> onMainThread(audience,
                                        p -> openDetails(p, entry.shopId(), query, page, kindFilter)),
                                CLICK_OPTIONS))
                        .build());
                buttons.add(spacer());
            }
        }

        DialogInput queryInput = DialogInput.text(INPUT_KEY_QUERY, Component.text("Search"))
                .initial(query)
                .maxLength(MAX_QUERY_LENGTH)
                .build();

        // Buttons render in a 2-column grid (columns(2) below). Search/Clear pair naturally on
        // one row; Filter gets a spacer so it doesn't pair with the results divider that follows.
        List<ActionButton> topButtons = new ArrayList<>();
        topButtons.add(button("Search", "Search shops for the item you typed",
                (response, audience) -> onMainThread(audience, player -> {
                    String newQuery = response.getText(INPUT_KEY_QUERY);
                    open(player, newQuery == null ? "" : newQuery, 0, kindFilter);
                })));
        topButtons.add(button("Clear", "Clear the search and show all shops",
                (response, audience) -> onMainThread(audience, player -> open(player, "", 0, null))));
        topButtons.add(button("Filter: " + filterLabel(kindFilter),
                "Cycle between all shops, selling only, and buying only",
                (response, audience) -> onMainThread(audience,
                        p -> open(p, query, 0, nextFilter(kindFilter)))));
        topButtons.add(spacer());

        List<ActionButton> allButtons = new ArrayList<>(topButtons);
        allButtons.addAll(buttons);

        boolean hasPrevious = page > 0;
        boolean hasNext = page < lastPage;
        if (hasPrevious) {
            allButtons.add(button("Previous", "Go to the previous page",
                    (response, audience) -> onMainThread(audience,
                            p -> open(p, query, page - 1, kindFilter))));
        }
        if (hasNext) {
            allButtons.add(button("Next", "Go to the next page",
                    (response, audience) -> onMainThread(audience,
                            p -> open(p, query, page + 1, kindFilter))));
        }
        if (hasPrevious != hasNext) {
            // only one of the two is present - pad it to its own row rather than pairing it
            // with whatever comes next (nothing does today, but this keeps it robust).
            allButtons.add(spacer());
        }

        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Shop Directory"))
                        .body(body)
                        .inputs(List.of(queryInput))
                        .canCloseWithEscape(true)
                        .build())
                .type(DialogType.multiAction(allButtons).columns(2).build()));
    }

    private static ActionButton button(String label, String tooltip, DialogActionCallback callback) {
        return ActionButton.builder(Component.text(label))
                .tooltip(Component.text(tooltip))
                .action(DialogAction.customClick(callback, CLICK_OPTIONS))
                .build();
    }

    /** An empty, non-interactive button used to pad a row out to the full 2-column width. */
    private static ActionButton spacer() {
        return ActionButton.builder(Component.empty()).build();
    }

    // ---------------------------------------------------------------- helpers

    /** e.g. {@code GOLDEN_CARROT} -> {@code "Golden Carrot"}. */
    private static String materialName(ShopDirectoryEntry entry) {
        String[] words = entry.item().name().toLowerCase(java.util.Locale.ROOT).split("_");
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

    private static String kindLabel(ShopDirectoryEntry.ShopKind kind) {
        return kind == ShopDirectoryEntry.ShopKind.SELLING ? "Selling" : "Buying";
    }

    private static String filterLabel(ShopDirectoryEntry.ShopKind kindFilter) {
        if (kindFilter == null) {
            return "All";
        }
        return kindFilter == ShopDirectoryEntry.ShopKind.SELLING ? "Selling" : "Buying";
    }

    /** Cycles All -> Selling -> Buying -> All. */
    private static ShopDirectoryEntry.ShopKind nextFilter(ShopDirectoryEntry.ShopKind kindFilter) {
        if (kindFilter == null) {
            return ShopDirectoryEntry.ShopKind.SELLING;
        }
        return kindFilter == ShopDirectoryEntry.ShopKind.SELLING ? ShopDirectoryEntry.ShopKind.BUYING : null;
    }

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
     * Distance to the shop, or {@code "?"} when it cannot be computed (different world -
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
     * Hands off to {@code ShopDetailsDialog}. If no {@link DetailsOpener} has been wired yet
     * (feature half-configured at startup), the player is told rather than hitting an NPE.
     */
    private void openDetails(Player player, String shopId, String query, int page,
                              ShopDirectoryEntry.ShopKind kindFilter) {
        DetailsOpener opener = this.detailsOpener;
        if (opener == null) {
            player.sendMessage(Component.text("Shop details are unavailable right now.", NamedTextColor.RED));
            plugin.getLogger().warning("ShopSearchResultsDialog has no details dialog wired; "
                    + "call setDetailsOpener(...) during startup.");
            return;
        }
        opener.open(player, shopId, query, page, kindFilter);
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
                            "Shop Directory dialog action failed for " + player.getName(), t);
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
            plugin.getLogger().log(Level.WARNING, "Failed to dispatch Shop Directory dialog action", t);
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
