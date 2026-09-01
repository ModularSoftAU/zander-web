package org.modularsoft.zander.velocity.commands;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import lombok.NonNull;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.util.api.FriendService;
import org.modularsoft.zander.velocity.util.messaging.VanishStatusResolver;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * /block &lt;player&gt; | /unblock &lt;player&gt; | /block list
 *
 * Registered for the aliases block, unblock, ignore and ignores. /ignore and
 * /ignores still work (mapped onto block semantics) and log a one-line
 * deprecation notice — they are superseded by /block.
 *
 * Blocks are one-directional and the blocked party is never told: the API
 * returns a benign response either way, so nothing here distinguishes "blocked"
 * from "not blocked".
 */
public class block implements SimpleCommand {

    private static final String PERMISSION = "zander.command.block";
    private static final int MAX_LIST = 20;

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

        final String alias = invocation.alias().toLowerCase();
        final String[] args = invocation.arguments();

        if (alias.startsWith("ignore")) {
            ZanderVelocityMain.getLogger().warn("/{} is deprecated and now maps to /block; tell players to use /block or /unblock.", alias);
        }

        // Normalise (alias, args) -> mode + target.
        String mode; // add | remove | list
        String target = null;

        if (alias.equals("unblock")) {
            mode = "remove";
            if (args.length < 1) {
                player.sendMessage(Component.text("Usage: /unblock <player>").color(NamedTextColor.RED));
                return;
            }
            target = args[0];
        } else if (alias.startsWith("ignore")) {
            if (args.length == 0) {
                player.sendMessage(Component.text("Usage: /block <player> | /block list").color(NamedTextColor.RED));
                return;
            }
            String sub = args[0].toLowerCase();
            if (sub.equals("list")) {
                mode = "list";
            } else if ((sub.equals("add") || sub.equals("remove")) && args.length >= 2) {
                mode = sub.equals("add") ? "add" : "remove";
                target = args[1];
            } else {
                mode = "add";
                target = args[0];
            }
        } else { // "block"
            if (args.length == 0) {
                player.sendMessage(Component.text("Usage: /block <player> | /block list").color(NamedTextColor.RED));
                return;
            }
            if (args[0].equalsIgnoreCase("list")) {
                mode = "list";
            } else {
                mode = "add";
                target = args[0];
            }
        }

        if (mode.equals("list")) {
            handleList(player);
            return;
        }

        if (target == null || target.isBlank()) {
            player.sendMessage(Component.text("Usage: /block <player> | /unblock <player>").color(NamedTextColor.RED));
            return;
        }
        if (target.equalsIgnoreCase(player.getUsername())) {
            player.sendMessage(Component.text("You cannot do that to yourself.").color(NamedTextColor.RED));
            return;
        }

        final String finalTarget = target;
        final boolean adding = mode.equals("add");
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            FriendService.ApiResult result = adding
                    ? friends().addBlock(player.getUniqueId(), finalTarget)
                    : friends().removeBlock(player.getUniqueId(), finalTarget);
            if (result.success()) {
                friends().invalidate(player.getUniqueId());
            }
            player.sendMessage(Component.text(
                            result.message().isEmpty() ? (result.success() ? "Done." : "That did not work.") : result.message())
                    .color(result.success() ? NamedTextColor.GREEN : NamedTextColor.RED));
        }).schedule();
    }

    private void handleList(Player player) {
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            Set<String> blocks = friends().getBlocks(player.getUniqueId());
            if (blocks.isEmpty()) {
                player.sendMessage(Component.text("You have not blocked anyone.").color(NamedTextColor.YELLOW));
                return;
            }
            List<String> names = new ArrayList<>(blocks);
            names.sort(String.CASE_INSENSITIVE_ORDER);
            int total = names.size();
            String shown = String.join(", ", names.subList(0, Math.min(MAX_LIST, total)));
            String suffix = total > MAX_LIST ? " and " + (total - MAX_LIST) + " more..." : "";
            player.sendMessage(Component.text("Blocked players (" + total + "): " + shown + suffix)
                    .color(NamedTextColor.GRAY));
        }).schedule();
    }

    @Override
    public List<String> suggest(@NonNull Invocation invocation) {
        String alias = invocation.alias().toLowerCase();
        String[] args = invocation.arguments();
        if (args.length > 1) {
            return List.of();
        }
        String prefix = args.length == 1 ? args[0].toLowerCase() : "";

        Stream<String> options = ZanderVelocityMain.getProxy().getAllPlayers().stream()
                .filter(p -> !VanishStatusResolver.isVanished(p))
                .map(Player::getUsername);
        if (alias.equals("block") || alias.startsWith("ignore")) {
            options = Stream.concat(Stream.of("list"), options);
        }
        return options
                .filter(name -> name.toLowerCase().startsWith(prefix))
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }
}
