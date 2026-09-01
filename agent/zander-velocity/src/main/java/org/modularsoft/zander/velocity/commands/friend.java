package org.modularsoft.zander.velocity.commands;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import lombok.NonNull;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.util.api.FriendService;
import org.modularsoft.zander.velocity.util.messaging.VanishStatusResolver;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * /friend add|accept|deny|remove|list|requests — modelled on {@link ignore}:
 * same subcommand switch, same suggest() shape, permission per subcommand.
 *
 * Every network call runs off the main thread via the proxy scheduler. The
 * accept prompt in /friend requests uses {@link ClickEvent#suggestCommand} (not
 * runCommand) so there is one code path for the actual accept.
 */
public class friend implements SimpleCommand {

    private static final String BASE = "zander.command.friend";
    private static final String ADD = "zander.command.friend.add";
    private static final String ACCEPT = "zander.command.friend.accept";
    private static final String REMOVE = "zander.command.friend.remove";
    private static final String LIST = "zander.command.friend.list";
    private static final String VANISH_SEE = "zander.friends.vanish.see";
    private static final int MAX_LIST = 50;

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
        if (!player.hasPermission(BASE)) {
            noPermission(player);
            return;
        }
        String[] args = invocation.arguments();
        if (args.length == 0) {
            usage(player);
            return;
        }
        switch (args[0].toLowerCase()) {
            case "add" -> mutate(player, args, ADD, "add", "/friend add <player>");
            case "accept" -> mutate(player, args, ACCEPT, "accept", "/friend accept <player>");
            case "deny", "decline" -> mutate(player, args, ACCEPT, "deny", "/friend deny <player>");
            case "remove" -> mutate(player, args, REMOVE, "remove", "/friend remove <player>");
            case "list" -> handleList(player);
            case "requests" -> handleRequests(player);
            default -> usage(player);
        }
    }

    private void mutate(Player player, String[] args, String permission, String action, String usage) {
        if (!player.hasPermission(permission)) {
            noPermission(player);
            return;
        }
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: " + usage).color(NamedTextColor.RED));
            return;
        }
        final String targetName = args[1];
        if (targetName.equalsIgnoreCase(player.getUsername())) {
            player.sendMessage(Component.text("You cannot do that to yourself.").color(NamedTextColor.RED));
            return;
        }
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            FriendService.ApiResult result = switch (action) {
                case "add" -> friends().sendRequest(player.getUniqueId(), targetName);
                case "accept" -> friends().acceptRequest(player.getUniqueId(), targetName);
                case "deny" -> friends().declineRequest(player.getUniqueId(), targetName);
                case "remove" -> friends().removeFriend(player.getUniqueId(), targetName);
                default -> new FriendService.ApiResult(false, "Unknown action.");
            };
            if (result.success()) {
                friends().invalidate(player.getUniqueId());
            }
            player.sendMessage(Component.text(
                            result.message().isEmpty() ? (result.success() ? "Done." : "That did not work.") : result.message())
                    .color(result.success() ? NamedTextColor.GREEN : NamedTextColor.RED));
        }).schedule();
    }

    private void handleList(Player player) {
        if (!player.hasPermission(LIST)) {
            noPermission(player);
            return;
        }
        boolean seesVanished = player.hasPermission(VANISH_SEE);
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            List<String> all = friends().getFriends(player.getUniqueId());
            if (all.isEmpty()) {
                player.sendMessage(Component.text("You have no friends added yet.").color(NamedTextColor.YELLOW));
                return;
            }
            // Staff with the bypass permission resolve presence locally (which
            // includes vanished players); everyone else gets the API's
            // already-vanish-filtered online set.
            final Set<String> online = seesVanished
                    ? proxyOnlineNames()
                    : friends().onlineFriends(player.getUniqueId());

            all.sort(String.CASE_INSENSITIVE_ORDER);
            int total = all.size();
            long onlineCount = all.stream().filter(n -> containsIgnoreCase(online, n)).count();

            player.sendMessage(Component.text("Friends (" + onlineCount + "/" + total + " online):")
                    .color(NamedTextColor.AQUA));
            for (String name : all.subList(0, Math.min(MAX_LIST, total))) {
                boolean isOnline = containsIgnoreCase(online, name);
                player.sendMessage(Component.text(" " + (isOnline ? "● " : "○ ") + name)
                        .color(isOnline ? NamedTextColor.GREEN : NamedTextColor.GRAY));
            }
            if (total > MAX_LIST) {
                player.sendMessage(Component.text(" ...and " + (total - MAX_LIST) + " more").color(NamedTextColor.DARK_GRAY));
            }
        }).schedule();
    }

    private void handleRequests(Player player) {
        if (!player.hasPermission(LIST)) {
            noPermission(player);
            return;
        }
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            List<String> incoming = friends().pendingIncoming(player.getUniqueId());
            if (incoming.isEmpty()) {
                player.sendMessage(Component.text("You have no incoming friend requests.").color(NamedTextColor.YELLOW));
                return;
            }
            player.sendMessage(Component.text("Incoming friend requests:").color(NamedTextColor.AQUA));
            for (String name : incoming) {
                Component line = Component.text(" " + name + " ").color(NamedTextColor.WHITE)
                        .append(Component.text("[Accept]")
                                .color(NamedTextColor.GREEN)
                                .clickEvent(ClickEvent.suggestCommand("/friend accept " + name))
                                .hoverEvent(HoverEvent.showText(Component.text("Click to fill the accept command"))))
                        .append(Component.text(" "))
                        .append(Component.text("[Deny]")
                                .color(NamedTextColor.RED)
                                .clickEvent(ClickEvent.suggestCommand("/friend deny " + name))
                                .hoverEvent(HoverEvent.showText(Component.text("Click to fill the deny command"))));
                player.sendMessage(line);
            }
        }).schedule();
    }

    @Override
    public List<String> suggest(@NonNull Invocation invocation) {
        String[] args = invocation.arguments();
        if (args.length <= 1) {
            String prefix = args.length == 1 ? args[0].toLowerCase() : "";
            return Stream.of("add", "accept", "deny", "remove", "list", "requests")
                    .filter(o -> o.startsWith(prefix))
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
        }
        if (args.length == 2) {
            String sub = args[0].toLowerCase();
            if (sub.equals("add") || sub.equals("accept") || sub.equals("deny")
                    || sub.equals("decline") || sub.equals("remove")) {
                String prefix = args[1].toLowerCase();
                // Same vanish filter as ignore.java / message.java.
                return ZanderVelocityMain.getProxy().getAllPlayers().stream()
                        .filter(p -> !VanishStatusResolver.isVanished(p))
                        .map(Player::getUsername)
                        .filter(name -> name.toLowerCase().startsWith(prefix))
                        .sorted(String.CASE_INSENSITIVE_ORDER)
                        .toList();
            }
        }
        return List.of();
    }

    private static Set<String> proxyOnlineNames() {
        return ZanderVelocityMain.getProxy().getAllPlayers().stream()
                .map(Player::getUsername)
                .collect(java.util.stream.Collectors.toSet());
    }

    private static boolean containsIgnoreCase(Set<String> set, String value) {
        for (String s : set) {
            if (s.equalsIgnoreCase(value)) {
                return true;
            }
        }
        return false;
    }

    private static void usage(Player player) {
        player.sendMessage(Component.text("Usage: /friend <add|accept|deny|remove|list|requests> [player]")
                .color(NamedTextColor.RED));
    }

    private static void noPermission(Player player) {
        player.sendMessage(Component.text("You do not have permission to use this command.").color(NamedTextColor.RED));
    }
}
