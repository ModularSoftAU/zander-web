package dev.anchorlight.zander.addon.dialog;

import dev.anchorlight.zander.addon.navigation.ShopNavigationService;
import dev.anchorlight.zander.addon.navigation.ShopNavigationSession;
import dev.anchorlight.zander.addon.shop.ShopDirectoryConfig;
import dev.anchorlight.zander.addon.shop.ShopDirectoryService;
import io.papermc.paper.dialog.Dialog;
import io.papermc.paper.registry.data.dialog.ActionButton;
import io.papermc.paper.registry.data.dialog.DialogBase;
import io.papermc.paper.registry.data.dialog.action.DialogAction;
import io.papermc.paper.registry.data.dialog.action.DialogActionCallback;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import io.papermc.paper.registry.data.dialog.input.DialogInput;
import io.papermc.paper.registry.data.dialog.type.DialogType;
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
 * Root Shop Directory dialog, shown by {@code /shops}.
 *
 * <p>Renders either the normal "search" view (text box + Search + Browse All Shops)
 * or, when the player has an active navigation session, a summary panel with
 * "Stop Navigation" / "Search Another Shop" buttons.</p>
 *
 * <p>This class never touches QuickShop types directly; everything it needs comes
 * from the addon-side services.</p>
 */
public class ShopDirectoryDialog {

    /** Input key for the search text box; read back via {@code DialogResponseView#getText}. */
    static final String INPUT_KEY_QUERY = "query";

    private static final int MAX_QUERY_LENGTH = 64;

    /**
     * Callback lifetime for dialog buttons. Dialogs are rebuilt on every {@link #open(Player)},
     * so the registration only needs to outlive one viewing session.
     */
    private static final ClickCallback.Options CLICK_OPTIONS = ClickCallback.Options.builder()
            .uses(ClickCallback.UNLIMITED_USES)
            .lifetime(Duration.ofMinutes(10))
            .build();

    private final Plugin plugin;
    private final ShopDirectoryService directoryService;
    private final ShopNavigationService navigationService;
    private final ShopDirectoryConfig config;

    /**
     * Opens the paginated search-results dialog.
     *
     * <p>Task 10 creates {@code ShopSearchResultsDialog}; Task 13 wires it in after
     * construction via {@link #setResultsOpener(ResultsOpener)} — typically
     * {@code rootDialog.setResultsOpener(resultsDialog::open)}. Using a functional
     * interface rather than a direct field type keeps the root/results/details
     * dialogs free of a compile-time circular dependency.</p>
     */
    @FunctionalInterface
    public interface ResultsOpener {
        void open(Player player, String query, int page);
    }

    private ResultsOpener resultsOpener;

    public ShopDirectoryDialog(Plugin plugin,
                               ShopDirectoryService directoryService,
                               ShopNavigationService navigationService,
                               ShopDirectoryConfig config) {
        this.plugin = plugin;
        this.directoryService = directoryService;
        this.navigationService = navigationService;
        this.config = config;
    }

    /** Wired by Task 13 once {@code ShopSearchResultsDialog} exists. */
    public void setResultsOpener(ResultsOpener resultsOpener) {
        this.resultsOpener = resultsOpener;
    }

    /**
     * Builds and shows the root dialog to the player. Never throws; on any failure the
     * player gets a plain chat message and the cause is logged.
     */
    public void open(Player player) {
        try {
            Optional<ShopNavigationSession> session =
                    config.navigationEnabled()
                            ? navigationService.activeSession(player.getUniqueId())
                            : Optional.empty();

            player.showDialog(session.isPresent()
                    ? buildNavigatingDialog(session.get(), player.getLocation())
                    : buildSearchDialog());
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open the shop directory.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Directory dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildSearchDialog() {
        List<DialogBody> body = new ArrayList<>();
        body.add(DialogBody.plainMessage(Component.text("Find a shop by item name.")));
        body.add(DialogBody.plainMessage(Component.text(
                directoryService.currentIndex().size() + " shops indexed.", NamedTextColor.GRAY)));

        DialogInput queryInput = DialogInput.text(INPUT_KEY_QUERY, Component.text("Item"))
                .initial("")
                .maxLength(MAX_QUERY_LENGTH)
                .build();

        List<ActionButton> buttons = List.of(
                button("Search", "Search shops for the item you typed",
                        (response, audience) -> {
                            String query = response.getText(INPUT_KEY_QUERY);
                            openResults(audience, query == null ? "" : query);
                        }),
                button("Browse All Shops", "Show every indexed shop",
                        (response, audience) -> openResults(audience, ""))
        );

        return dialog("Shop Directory", body, List.of(queryInput), buttons);
    }

    private Dialog buildNavigatingDialog(ShopNavigationSession session, Location viewerLocation) {
        List<DialogBody> body = new ArrayList<>();
        body.add(DialogBody.plainMessage(Component.text("Currently navigating to:", NamedTextColor.YELLOW)));
        body.add(DialogBody.plainMessage(Component.text(session.itemDisplayName())));
        body.add(DialogBody.plainMessage(Component.text("Owner: " + session.ownerDisplayName(), NamedTextColor.GRAY)));
        body.add(DialogBody.plainMessage(
                Component.text("Distance: " + distanceLabel(session, viewerLocation), NamedTextColor.GRAY)));

        List<ActionButton> buttons = List.of(
                button("Stop Navigation", "Cancel the current navigation",
                        (response, audience) -> onMainThread(audience, p -> {
                            navigationService.cancel(p.getUniqueId());
                            p.sendMessage(Component.text("Navigation stopped.", NamedTextColor.YELLOW));
                        })),
                button("Search Another Shop", "Open the shop search",
                        (response, audience) -> onMainThread(audience, this::showSearchDialog))
        );

        return dialog("Shop Directory", body, List.of(), buttons);
    }

    private Dialog dialog(String title,
                          List<DialogBody> body,
                          List<DialogInput> inputs,
                          List<ActionButton> buttons) {
        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text(title))
                        .body(body)
                        .inputs(inputs)
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

    /**
     * Distance to the navigation target, or {@code "?"} when it cannot be computed
     * (different world — {@link ShopNavigationSession#distanceTo(Location)} throws).
     */
    private static String distanceLabel(ShopNavigationSession session, Location viewerLocation) {
        try {
            return Math.round(session.distanceTo(viewerLocation)) + " blocks";
        } catch (Throwable t) {
            return "?";
        }
    }

    /**
     * Re-shows the search view. Split out so the "Search Another Shop" button can reuse it.
     */
    private void showSearchDialog(Player player) {
        try {
            player.showDialog(buildSearchDialog());
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open the shop directory.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Directory search dialog for " + player.getName(), t);
        }
    }

    /**
     * Hands off to the results dialog. If Task 13 has not wired a {@link ResultsOpener}
     * (or wiring was skipped because the feature is half-configured), the player is told
     * rather than hitting an NPE.
     */
    private void openResults(net.kyori.adventure.audience.Audience audience, String query) {
        onMainThread(audience, player -> {
            ResultsOpener opener = this.resultsOpener;
            if (opener == null) {
                player.sendMessage(Component.text("Shop search is unavailable right now.", NamedTextColor.RED));
                plugin.getLogger().warning("ShopDirectoryDialog has no results dialog wired; "
                        + "call setResultsOpener(...) during startup.");
                return;
            }
            opener.open(player, query, 0);
        });
    }

    /**
     * Dialog callback threading is not documented in the Paper API, so every handler that
     * touches Bukkit or the shop services is dispatched onto the main thread explicitly.
     * Already-main-thread callbacks run inline so behaviour stays synchronous where possible.
     */
    private void onMainThread(net.kyori.adventure.audience.Audience audience, PlayerAction action) {
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
    }

    @FunctionalInterface
    private interface PlayerAction {
        void run(Player player);
    }
}
