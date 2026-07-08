package org.modularsoft.zander.pgm.command;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.modularsoft.zander.pgm.ZanderPGMPlugin;
import org.modularsoft.zander.pgm.config.ZanderPGMConfig;
import org.modularsoft.zander.pgm.pgm.MatchIdentityService;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/** Admin command {@code /zpgm} with status, reload, reconnect, flush, debug, vote, maptokens, rating. */
public class ZpgmCommand implements CommandExecutor, TabCompleter {

    private static final List<String> ROOT = Arrays.asList(
            "status", "reload", "reconnect", "flush", "debug", "vote", "maptokens", "rating");

    private final ZanderPGMPlugin plugin;

    public ZpgmCommand(ZanderPGMPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("zanderpgm.admin")) {
            sender.sendMessage("§cYou do not have permission.");
            return true;
        }
        if (args.length == 0) {
            sender.sendMessage("§6/zpgm §7<" + String.join("|", ROOT) + ">");
            return true;
        }
        switch (args[0].toLowerCase()) {
            case "status" -> status(sender);
            case "reload" -> {
                plugin.reloadPluginConfig();
                sender.sendMessage("§aConfig reloaded and connections refreshed.");
            }
            case "reconnect" -> {
                plugin.ws().reconnect();
                sender.sendMessage("§aReconnecting WebSocket...");
            }
            case "flush" -> {
                plugin.flushQueue();
                sender.sendMessage("§aFlushing queued events...");
            }
            case "debug" -> debug(sender);
            case "vote" -> vote(sender, args);
            case "maptokens" -> maptokens(sender, args);
            case "rating" -> rating(sender, args);
            default -> sender.sendMessage("§cUnknown subcommand.");
        }
        return true;
    }

    private void status(CommandSender sender) {
        ZanderPGMConfig cfg = plugin.cfg();
        MatchIdentityService.Identity id = plugin.identity().current();
        sender.sendMessage("§6=== ZanderPGM Status ===");
        sender.sendMessage("§7Server ID: §f" + cfg.serverId);
        sender.sendMessage("§7API base: §f" + cfg.baseUrl);
        sender.sendMessage("§7REST reachable: " + yn(plugin.health().isRestReachable()));
        sender.sendMessage("§7WebSocket: " + yn(plugin.ws().isConnected()));
        sender.sendMessage("§7Queued events: §f" + plugin.queue().size()
                + " §7(dropped: " + plugin.queue().droppedCount() + ")");
        sender.sendMessage("§7Current match: §f" + (id != null ? id.matchId : "none"));
        sender.sendMessage("§7Current map: §f" + (id != null ? id.mapName : "none"));
        sender.sendMessage("§7Players online: §f" + Bukkit.getOnlinePlayers().size());
        String features = cfg.features.entrySet().stream()
                .filter(java.util.Map.Entry::getValue)
                .map(java.util.Map.Entry::getKey)
                .collect(Collectors.joining(", "));
        sender.sendMessage("§7Enabled features: §f" + features);
    }

    private void debug(CommandSender sender) {
        MatchIdentityService.Identity id = plugin.identity().current();
        if (id == null) {
            sender.sendMessage("§eNo match loaded.");
            return;
        }
        sender.sendMessage("§6=== Match Debug ===");
        sender.sendMessage("§7Match ID: §f" + id.matchId);
        sender.sendMessage("§7Map: §f" + id.mapName + " §7(" + id.mapKey + ") v" + id.mapVersion);
        sender.sendMessage("§7Tracked players: §f" + plugin.stats().allPlayers().size());
        sender.sendMessage("§7Players online: §f" + Bukkit.getOnlinePlayers().size());
    }

    private void vote(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage("§c/zpgm vote <start|end|status|cancel>");
            return;
        }
        switch (args[1].toLowerCase()) {
            case "start" -> {
                if (plugin.votes().start() != null) {
                    sender.sendMessage("§aMap vote started.");
                } else {
                    sender.sendMessage("§cCould not start a vote (disabled or already active).");
                }
            }
            case "end" -> {
                plugin.votes().end();
                sender.sendMessage("§aMap vote ended.");
            }
            case "cancel" -> {
                plugin.votes().cancel("admin");
                sender.sendMessage("§aMap vote cancelled.");
            }
            case "status" -> sender.sendMessage("§7Vote active: " + yn(plugin.votes().isActive()));
            default -> sender.sendMessage("§c/zpgm vote <start|end|status|cancel>");
        }
    }

    private void maptokens(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage("§c/zpgm maptokens <status|clear>");
            return;
        }
        switch (args[1].toLowerCase()) {
            case "status" -> sender.sendMessage("§7Map tokens: §f" + plugin.tokens().status());
            case "clear" -> {
                plugin.tokens().clearOverride();
                sender.sendMessage("§aCleared pending next-map override.");
            }
            default -> sender.sendMessage("§c/zpgm maptokens <status|clear>");
        }
    }

    private void rating(CommandSender sender, String[] args) {
        if (args.length >= 2 && args[1].equalsIgnoreCase("reset")) {
            plugin.ratings().reset();
            sender.sendMessage("§aRating session reset.");
            return;
        }
        sender.sendMessage("§c/zpgm rating reset <map>");
    }

    private String yn(boolean b) {
        return b ? "§ayes" : "§cno";
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return ROOT.stream().filter(s -> s.startsWith(args[0].toLowerCase())).collect(Collectors.toList());
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("vote")) {
            return Arrays.asList("start", "end", "status", "cancel");
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("maptokens")) {
            return Arrays.asList("status", "clear");
        }
        return List.of();
    }
}
