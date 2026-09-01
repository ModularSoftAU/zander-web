package org.modularsoft.zander.velocity.commands;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import lombok.NonNull;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.util.api.FriendService;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * /settings — print or change the calling player's friends/privacy preferences.
 *
 *   /settings
 *   /settings messages   &lt;everyone|friends|none&gt;
 *   /settings requests   &lt;everyone|friends|none&gt;
 *   /settings friendslist &lt;public|private&gt;
 *   /settings joinalerts &lt;on|off&gt;
 *
 * One source of truth: this writes through {@code PATCH-equivalent} POST
 * /api/settings, the same store the website edits.
 */
public class settings implements SimpleCommand {

    private static final String PERMISSION = "zander.command.settings";
    private static final List<String> MODE_VALUES = List.of("everyone", "friends", "none");

    private FriendService friends() {
        return ZanderVelocityMain.getFriendService();
    }

    @Override
    public void execute(@NonNull Invocation invocation) {
        CommandSource source = invocation.source();
        if (!(source instanceof Player player)) {
            source.sendMessage(Component.text("This command can only be used by players.").color(NamedTextColor.RED));
            return;
        }
        if (!player.hasPermission(PERMISSION)) {
            player.sendMessage(Component.text("You do not have permission to use this command.").color(NamedTextColor.RED));
            return;
        }

        String[] args = invocation.arguments();
        if (args.length == 0) {
            printCurrent(player);
            return;
        }
        if (args.length < 2) {
            usage(player);
            return;
        }

        String key = args[0].toLowerCase();
        String value = args[1].toLowerCase();
        Map<String, Object> patch;

        switch (key) {
            case "messages" -> {
                if (!MODE_VALUES.contains(value)) { usage(player); return; }
                patch = Map.of("allowMessagesFrom", value);
            }
            case "requests" -> {
                if (!MODE_VALUES.contains(value)) { usage(player); return; }
                patch = Map.of("allowFriendRequests", value);
            }
            case "friendslist" -> {
                if (!value.equals("public") && !value.equals("private")) { usage(player); return; }
                patch = Map.of("friendsListVisible", value.equals("public"));
            }
            case "joinalerts" -> {
                if (!value.equals("on") && !value.equals("off")) { usage(player); return; }
                patch = Map.of("notifyFriendJoin", value.equals("on"));
            }
            default -> {
                usage(player);
                return;
            }
        }

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            FriendService.ApiResult result = friends().updateSettings(player.getUniqueId(), patch);
            if (result.success()) {
                friends().invalidate(player.getUniqueId());
            }
            player.sendMessage(Component.text(
                            result.message().isEmpty() ? (result.success() ? "Settings updated." : "That did not work.") : result.message())
                    .color(result.success() ? NamedTextColor.GREEN : NamedTextColor.RED));
        }).schedule();
    }

    private void printCurrent(Player player) {
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            Optional<FriendService.Settings> maybe = friends().getSettings(player.getUniqueId());
            if (maybe.isEmpty()) {
                player.sendMessage(Component.text("Your settings are unavailable right now, try again shortly.")
                        .color(NamedTextColor.RED));
                return;
            }
            FriendService.Settings s = maybe.get();
            player.sendMessage(Component.text("Your settings:").color(NamedTextColor.AQUA));
            player.sendMessage(Component.text("  messages: " + s.allowMessagesFrom()).color(NamedTextColor.GRAY));
            player.sendMessage(Component.text("  requests: " + s.allowFriendRequests()).color(NamedTextColor.GRAY));
            player.sendMessage(Component.text("  friendslist: " + (s.friendsListVisible() ? "public" : "private")).color(NamedTextColor.GRAY));
            player.sendMessage(Component.text("  joinalerts: " + (s.notifyFriendJoin() ? "on" : "off")).color(NamedTextColor.GRAY));
        }).schedule();
    }

    @Override
    public List<String> suggest(@NonNull Invocation invocation) {
        String[] args = invocation.arguments();
        if (args.length <= 1) {
            String prefix = args.length == 1 ? args[0].toLowerCase() : "";
            return Stream.of("messages", "requests", "friendslist", "joinalerts")
                    .filter(o -> o.startsWith(prefix))
                    .toList();
        }
        if (args.length == 2) {
            String key = args[0].toLowerCase();
            String prefix = args[1].toLowerCase();
            List<String> values = switch (key) {
                case "messages", "requests" -> MODE_VALUES;
                case "friendslist" -> List.of("public", "private");
                case "joinalerts" -> List.of("on", "off");
                default -> List.of();
            };
            return values.stream().filter(v -> v.startsWith(prefix)).toList();
        }
        return List.of();
    }

    private static void usage(Player player) {
        player.sendMessage(Component.text("Usage: /settings [messages|requests <everyone|friends|none>] "
                + "[friendslist <public|private>] [joinalerts <on|off>]").color(NamedTextColor.RED));
    }
}
