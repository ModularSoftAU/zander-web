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
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;

/**
 * Single-shop details dialog, opened from {@link ShopSearchResultsDialog} when a player
 * clicks a search result row. Offers a "Guide Me" navigation button (same-world only)
 * and a "Back to Results" button that returns the player to exactly the search/page/filter
 * state they came from.
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

    public ShopDetailsDialog(Plugin plugin,
                              ShopDirectoryService directoryService,
                              ShopNavigationService navigationService,
                              ShopSearchResultsDialog resultsDialog) {
        this.plugin = plugin;
        this.directoryService = directoryService;
        this.navigationService = navigationService;
        this.resultsDialog = resultsDialog;
    }

    /**
     * Builds and shows the details dialog for {@code shopId}. Always re-resolves the shop via
     * {@link ShopDirectoryService#resolve(String)} first - a shop's price/stock/owner can
     * change or the shop can be deleted between when a search result was shown and when the
     * player clicks into details, so a stale passed-in entry is never trusted directly.
     *
     * @param query      the search query the player found this shop under; threaded through so
     *                   "Back to Results" returns to the same directory state.
     * @param page       the 0-based results page the player found this shop on.
     * @param kindFilter the shop-kind filter active when the player found this shop.
     */
    public void open(Player player, String shopId, String query, int page, ShopDirectoryEntry.ShopKind kindFilter) {
        try {
            Optional<ShopDirectoryEntry> resolved = directoryService.resolve(shopId);
            if (resolved.isEmpty()) {
                player.sendMessage(Component.text("This shop is no longer available.", NamedTextColor.RED));
                resultsDialog.open(player, query, page, kindFilter);
                return;
            }
            player.showDialog(buildDialog(resolved.get(), player, query, page, kindFilter));
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open shop details.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Details dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildDialog(ShopDirectoryEntry entry, Player player, String query, int page,
                                ShopDirectoryEntry.ShopKind kindFilter) {
        List<DialogBody> body = new ArrayList<>();
        List<ActionButton> buttons = new ArrayList<>();

        boolean sameWorld = entry.world().equals(player.getWorld().getName());

        // Shop owners can rename their item (e.g. an anvil-renamed "d"), so when the display
        // name isn't obviously the material itself, show the real material too.
        String materialName = materialName(entry);
        String itemTitle = entry.itemDisplayName().equalsIgnoreCase(materialName)
                ? entry.itemDisplayName()
                : entry.itemDisplayName() + " (" + materialName + ")";

        // Shows the actual item icon. ActionButton has no icon support in the Paper Dialog API
        // (text/tooltip only), so this only works here where there's a single item to show -
        // it's not possible to pair an icon with each clickable row in the results list.
        body.add(DialogBody.item(new ItemStack(entry.item()))
                .showTooltip(false)
                .build());

        // Each plainMessage is its own block with its own vertical padding, so lines are grouped
        // as few, wider lines rather than one field per line to keep the dialog compact.
        body.add(DialogBody.plainMessage(Component.text(itemTitle, NamedTextColor.WHITE)));
        body.add(DialogBody.plainMessage(Component.text(
                "Seller: " + entry.ownerDisplayName() + "  |  Price: " + formatPrice(entry.price())
                        + "  |  Type: " + kindLabel(entry.kind()),
                NamedTextColor.WHITE)));

        if (sameWorld) {
            body.add(DialogBody.plainMessage(Component.text(
                    "Stock: " + formatStock(entry.stock())
                            + "  |  Distance: " + distanceLabel(entry, player.getLocation()),
                    NamedTextColor.WHITE)));
        } else {
            body.add(DialogBody.plainMessage(Component.text(
                    "Stock: " + formatStock(entry.stock()), NamedTextColor.WHITE)));
            body.add(DialogBody.plainMessage(Component.text(
                    "This shop is in the " + entry.world() + " world.\nTravel there before starting navigation.",
                    NamedTextColor.YELLOW)));
        }

        body.add(DialogBody.plainMessage(Component.text(
                "World: " + entry.world() + "  |  Location: " + coordinatesLabel(entry.location()),
                NamedTextColor.WHITE)));

        if (sameWorld) {
            String shopId = entry.shopId();
            buttons.add(button("Guide Me", "Start navigation to this shop",
                    (response, audience) -> onMainThread(audience,
                            p -> startGuide(p, shopId, query, page, kindFilter))));
        }

        // "Back to Results" is the exit action rather than a regular button: it's always
        // rendered separately from Guide Me, so it stays easy to find regardless of how many
        // other buttons are on screen.
        ActionButton backButton = ActionButton.builder(Component.text("Back to Results"))
                .tooltip(Component.text("Return to the shop directory"))
                .action(DialogAction.customClick(
                        (response, audience) -> onMainThread(audience,
                                p -> resultsDialog.open(p, query, page, kindFilter)),
                        CLICK_OPTIONS))
                .build();

        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Shop Details"))
                        .body(body)
                        .canCloseWithEscape(true)
                        .build())
                .type(DialogType.multiAction(buttons).exitAction(backButton).columns(1).build()));
    }

    private static ActionButton button(String label, String tooltip, DialogActionCallback callback) {
        return ActionButton.builder(Component.text(label))
                .tooltip(Component.text(tooltip))
                .action(DialogAction.customClick(callback, CLICK_OPTIONS))
                .build();
    }

    // ---------------------------------------------------------------- helpers

    private void startGuide(Player player, String shopId, String query, int page,
                             ShopDirectoryEntry.ShopKind kindFilter) {
        Optional<ShopDirectoryEntry> resolved = directoryService.resolve(shopId);
        if (resolved.isEmpty()) {
            player.sendMessage(Component.text("This shop is no longer available.", NamedTextColor.RED));
            resultsDialog.open(player, query, page, kindFilter);
            return;
        }
        ShopDirectoryEntry entry = resolved.get();
        if (!entry.world().equals(player.getWorld().getName())) {
            player.sendMessage(Component.text(
                    "This shop is in the " + entry.world() + " world.\nTravel there before starting navigation.",
                    NamedTextColor.YELLOW));
            return;
        }
        navigationService.start(player, entry);
        player.sendMessage(Component.text(
                "Navigating to " + entry.itemDisplayName() + ".", NamedTextColor.GREEN));
    }

    private static String kindLabel(ShopDirectoryEntry.ShopKind kind) {
        return kind == ShopDirectoryEntry.ShopKind.SELLING ? "Selling" : "Buying";
    }

    /** Duplicated from {@link ShopSearchResultsDialog#materialName(ShopDirectoryEntry)}. */
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
     * Duplicated from {@link ShopSearchResultsDialog#formatStock(int)} - same "Unlimited"
     * special-case for the {@code Integer.MAX_VALUE} sentinel.
     */
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
