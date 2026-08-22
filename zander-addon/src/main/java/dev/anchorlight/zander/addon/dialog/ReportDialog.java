package dev.anchorlight.zander.addon.dialog;

import dev.anchorlight.zander.addon.report.ReportService;
import io.papermc.paper.dialog.Dialog;
import io.papermc.paper.registry.data.dialog.ActionButton;
import io.papermc.paper.registry.data.dialog.DialogBase;
import io.papermc.paper.registry.data.dialog.action.DialogAction;
import io.papermc.paper.registry.data.dialog.action.DialogActionCallback;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import io.papermc.paper.registry.data.dialog.input.DialogInput;
import io.papermc.paper.registry.data.dialog.input.SingleOptionDialogInput;
import io.papermc.paper.registry.data.dialog.type.DialogType;
import net.kyori.adventure.audience.Audience;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickCallback;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;

/**
 * The {@code /report} dialog: pick an online player from a dropdown (so reporters can't
 * mistype a name, and self-reporting is impossible since the reporter is never listed) and
 * type a reason, then submit via {@link ReportService}.
 *
 * <p>This replaces the old {@code /report <username> <reason>} command that lived in
 * zander-velocity - that command couldn't use the Dialog API because it's a Paper/Bukkit-only
 * API tied to a real {@code Player} object, which a Velocity proxy command never has.</p>
 */
public class ReportDialog {

    private static final String INPUT_KEY_TARGET = "target";
    private static final String INPUT_KEY_REASON = "reason";
    private static final int MAX_REASON_LENGTH = 256;

    private static final ClickCallback.Options CLICK_OPTIONS = ClickCallback.Options.builder()
            .uses(ClickCallback.UNLIMITED_USES)
            .lifetime(Duration.ofMinutes(10))
            .build();

    private final Plugin plugin;
    private final ReportService reportService;

    public ReportDialog(Plugin plugin, ReportService reportService) {
        this.plugin = plugin;
        this.reportService = reportService;
    }

    /**
     * Builds and shows the report dialog to the player. Never throws; on any failure the
     * player gets a plain chat message and the cause is logged.
     */
    public void open(Player player) {
        try {
            List<SingleOptionDialogInput.OptionEntry> targets = onlineTargets(player);
            player.showDialog(targets.isEmpty() ? buildNoTargetsDialog() : buildReportDialog(targets));
        } catch (Throwable t) {
            player.sendMessage(Component.text("Could not open the report dialog.", NamedTextColor.RED));
            plugin.getLogger().log(Level.WARNING, "Failed to open Report dialog for " + player.getName(), t);
        }
    }

    // ---------------------------------------------------------------- builders

    private Dialog buildReportDialog(List<SingleOptionDialogInput.OptionEntry> targets) {
        List<DialogBody> body = List.of(
                DialogBody.plainMessage(Component.text("Report a player to staff.", NamedTextColor.GRAY)));

        DialogInput targetInput = DialogInput.singleOption(
                INPUT_KEY_TARGET, Component.text("Player"), targets).build();
        DialogInput reasonInput = DialogInput.text(INPUT_KEY_REASON, Component.text("Reason"))
                .initial("")
                .maxLength(MAX_REASON_LENGTH)
                .build();

        ActionButton submitButton = ActionButton.builder(Component.text("Submit Report"))
                .tooltip(Component.text("Send this report to staff"))
                .action(DialogAction.customClick(
                        (response, audience) -> onMainThread(audience, player -> {
                            String target = response.getText(INPUT_KEY_TARGET);
                            String reason = response.getText(INPUT_KEY_REASON);
                            handleSubmit(player, target, reason);
                        }),
                        CLICK_OPTIONS))
                .build();

        ActionButton cancelButton = button("Cancel", "Close without reporting", (response, audience) -> {});

        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Report Player"))
                        .body(body)
                        .inputs(List.of(targetInput, reasonInput))
                        .canCloseWithEscape(true)
                        .build())
                .type(DialogType.multiAction(List.of(submitButton)).exitAction(cancelButton).columns(1).build()));
    }

    private Dialog buildNoTargetsDialog() {
        List<DialogBody> body = List.of(DialogBody.plainMessage(
                Component.text("There is no other player online to report right now.", NamedTextColor.GRAY)));
        ActionButton closeButton = button("Close", "Close this dialog", (response, audience) -> {});
        return Dialog.create(factory -> factory.empty()
                .base(DialogBase.builder(Component.text("Report Player"))
                        .body(body)
                        .canCloseWithEscape(true)
                        .build())
                .type(DialogType.multiAction(List.of()).exitAction(closeButton).columns(1).build()));
    }

    private static ActionButton button(String label, String tooltip, DialogActionCallback callback) {
        return ActionButton.builder(Component.text(label))
                .tooltip(Component.text(tooltip))
                .action(DialogAction.customClick(callback, CLICK_OPTIONS))
                .build();
    }

    // ---------------------------------------------------------------- helpers

    /** Every other online player, excluding the reporter - makes self-reporting impossible by construction. */
    private static List<SingleOptionDialogInput.OptionEntry> onlineTargets(Player reporter) {
        List<SingleOptionDialogInput.OptionEntry> entries = new ArrayList<>();
        boolean first = true;
        for (Player online : Bukkit.getOnlinePlayers()) {
            if (online.getUniqueId().equals(reporter.getUniqueId())) {
                continue;
            }
            entries.add(SingleOptionDialogInput.OptionEntry.create(
                    online.getName(), Component.text(online.getName()), first));
            first = false;
        }
        return entries;
    }

    private void handleSubmit(Player player, String target, String reason) {
        if (target == null || target.isBlank()) {
            player.sendMessage(Component.text("Please select a player to report.", NamedTextColor.RED));
            return;
        }
        if (reason == null || reason.isBlank()) {
            player.sendMessage(Component.text("Please enter a reason for the report.", NamedTextColor.RED));
            return;
        }

        String safeReason = reason.trim();
        player.sendMessage(Component.text("Submitting your report...", NamedTextColor.GRAY));
        reportService.submit(player, target, safeReason, result -> {
            if (!player.isOnline()) {
                return;
            }
            player.sendMessage(Component.text(result.message(),
                    result.success() ? NamedTextColor.GREEN : NamedTextColor.RED));
        });
    }

    /**
     * Dialog callback threading is not documented in the Paper API, so every handler that
     * touches Bukkit is dispatched onto the main thread explicitly. Already-main-thread
     * callbacks run inline so behaviour stays synchronous where possible.
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
                    plugin.getLogger().log(Level.WARNING, "Report dialog action failed for " + player.getName(), t);
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
            plugin.getLogger().log(Level.WARNING, "Failed to dispatch Report dialog action", t);
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
