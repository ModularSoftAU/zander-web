package dev.anchorlight.zander.addon.dialog;

import dev.anchorlight.zander.addon.navigation.ShopNavigationService;
import dev.anchorlight.zander.addon.navigation.ShopNavigationSession;
import dev.anchorlight.zander.addon.shop.ShopDirectoryConfig;
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
 * Root Shop Directory entry point, shown by {@code /shops}.
 *
 * <p>When the player has no active navigation session, this immediately hands off to the
 * shop directory/search-results screen ({@code ShopSearchResultsDialog}) with an empty query
 * and page 0 - there is no separate "search first" screen. When the player does have an
 * active navigation session, this shows a summary panel with "Stop Navigation" /
 * "Search Another Shop" buttons instead.</p>
 *
 * <p>This class never touches QuickShop types directly; everything it needs comes
 * from the addon-side services.</p>
 */
public class ShopDirectoryDialog {

    /**
     * Callback lifetime for dialog buttons. Dialogs are rebuilt on every {@link #open(Player)},
     * so the registration only needs to outlive one viewing session.
     */
    private static final ClickCallback.Options CLICK_OPTIONS = ClickCallback.Options.builder()
            .uses(ClickCallback.UNLIMITED_USES)
            .lifetime(Duration.ofMinutes(10))
            .build();

    private final Plugin plugin;
    private final ShopNavigationService navigationService;
    private final ShopDirectoryConfig config;

    /**
     * Opens the shop directory/search-results screen.
     *
     * <p>Wired post-construction via {@link #setResultsOpener(ResultsOpener)} - typically
     * {@code rootDialog.setResultsOpener(resultsDialog::open)}. Using a functional interface
     * rather than a direct field type keeps the root/results/details dialogs free of a
     * compile-time circular dependency.</p>
     */
    @FunctionalInterface
    public interface ResultsOpener {
        void open(Player player, String query, int page);
    }

    private ResultsOpener resultsOpener;

    public ShopDirectoryDialog(Plugin plugin,
                               ShopNavigationService navigationService,
                               ShopDirectoryConfig config) {
        this.plugin = plugin;
        this.navigationService = navigationService;
        this.config = config;
    }

    /** Wired once {@code ShopSearchResultsDialog} exists. */
    public void setResultsOpener(ResultsOpener resultsOpener) {
        this.resultsOpener = resultsOpener;
    }

    /**
     * Shows the player either the navigation summary (if they're currently being guided to a
     * shop) or, otherwise, the shop directory itself. Never throws; on any failure the player
     * gets a plain chat message and the cause is logged.
     */
    public void open(Player player) {
        try {
            Optional<ShopNavigationSession> session =
                    config.navigationEnabled()
                            ? navigationService.activeSession(player.getUniqueId())
                            : Optional.empty();

            if (session.isPresent()) {
                player.showDialog(buildNavigatingDialog(session.get(), player.getLocation()));
            } else {
                openResults(player, "");
            }
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open the shop directory.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING,
                    "Failed to open Shop Directory dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildNavigatingDialog(ShopNavigationSession session, Location viewerLocation) {
        List<DialogBody> body = new ArrayList<>();
        body.add(DialogBody.plainMessage(Component.text("Currently navigating to:", NamedTextColor.YELLOW)));
        body.add(DialogBody.plainMessage(Component.text(session.itemDisplayName())));
        body.add(DialogBody.plainMessage(Component.text("Owner: " + session.ownerDisplayName(), NamedTextColor.GRAY)));
        body.add(DialogBody.plainMessage(
                Component.text("Distance: " + distanceLabel(session, viewerLocation), NamedTextColor.GRAY)));

        List<ActionButton> buttons = List.of(
                button("Stop Navigation", "Cancel the current navigation",
                        (response, audience) -> onMainThread(audience,
                                p -> navigationService.cancel(p.getUniqueId()))),
                button("Search Another Shop", "Open the shop directory",
                        (response, audience) -> openResults(audience, ""))
        );

        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Shop Directory"))
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

    /**
     * Distance to the navigation target, or {@code "?"} when it cannot be computed
     * (different world - {@link ShopNavigationSession#distanceTo(Location)} throws).
     */
    private static String distanceLabel(ShopNavigationSession session, Location viewerLocation) {
        try {
            return Math.round(session.distanceTo(viewerLocation)) + " blocks";
        } catch (Throwable t) {
            return "?";
        }
    }

    /**
     * Hands off to the directory/results dialog. If no {@link ResultsOpener} has been wired
     * (feature half-configured at startup), the player is told rather than hitting an NPE.
     */
    private void openResults(Audience audience, String query) {
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
