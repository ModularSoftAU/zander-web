package org.modularsoft.zander.addon.pettrust.commands;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.pettrust.TrustLevel;
import org.modularsoft.zander.addon.pettrust.model.AnchorData;
import org.modularsoft.zander.addon.pettrust.model.PetTrustData;
import org.modularsoft.zander.addon.pettrust.model.PlayerTrustEntry;
import org.modularsoft.zander.addon.pettrust.service.PetTrustService;
import org.modularsoft.zander.addon.pettrust.util.MessageUtil;
import org.modularsoft.zander.addon.pettrust.util.PetTargetResolver;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public class PetTrustCommand implements CommandExecutor, TabCompleter {
    private final ZanderAddonMain plugin;
    private final PetTrustService service;

    public PetTrustCommand(ZanderAddonMain plugin, PetTrustService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command,
                             @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("This command can only be used by players.");
            return true;
        }

        if (!player.hasPermission("zanderaddon.pettrust.use")) {
            MessageUtil.send(player, plugin.getConfig(), "noPermission",
                "&cYou don't have permission to use /pettrust.");
            return true;
        }

        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) {
            MessageUtil.send(player, plugin.getConfig(), "featureDisabled",
                "&cPetTrust is currently disabled.");
            return true;
        }

        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            sendHelp(player);
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "trust"    -> handleTrust(player, args);
            case "untrust"  -> handleUntrust(player, args);
            case "public"   -> handlePublic(player, args);
            case "private"  -> handlePrivate(player, args);
            case "list", "info" -> handleList(player);
            case "anchor"   -> handleAnchor(player, args);
            case "unanchor" -> handleUnanchor(player);
            default         -> sendHelp(player);
        }
        return true;
    }

    // ── Subcommands ───────────────────────────────────────────────────────────

    private void handleTrust(Player player, String[] args) {
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: /pettrust trust <player> [ACCESS|MANAGE]").color(NamedTextColor.RED));
            return;
        }

        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can change trust for this pet.");
            return;
        }

        Player target = Bukkit.getPlayer(args[1]);
        if (target == null) {
            player.sendMessage(Component.text("That player is not online.").color(NamedTextColor.RED));
            return;
        }
        if (target.getUniqueId().equals(player.getUniqueId())) {
            player.sendMessage(Component.text("You already have full access to your own pet.").color(NamedTextColor.YELLOW));
            return;
        }

        String defaultLevelStr = plugin.getConfig().getString("petTrust.defaultTrustLevel", "ACCESS");
        TrustLevel level = args.length >= 3 ? TrustLevel.parse(args[2]) : TrustLevel.parse(defaultLevelStr);
        if (level == null) {
            player.sendMessage(Component.text("Invalid trust level. Valid values: " + TrustLevel.validValues()).color(NamedTextColor.RED));
            return;
        }

        service.setPlayerTrust(pet, target, level);
        player.sendMessage(Component.text("Trusted ")
            .append(Component.text(target.getName()).color(NamedTextColor.AQUA))
            .append(Component.text(" with "))
            .append(Component.text(level.name()).color(NamedTextColor.GREEN))
            .append(Component.text(" on this " + formatType(pet) + "."))
            .color(NamedTextColor.WHITE));
    }

    private void handleUntrust(Player player, String[] args) {
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: /pettrust untrust <player>").color(NamedTextColor.RED));
            return;
        }

        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can change trust for this pet.");
            return;
        }

        UUID targetUuid;
        String targetName = args[1];

        Player online = Bukkit.getPlayer(args[1]);
        if (online != null) {
            targetUuid = online.getUniqueId();
            targetName = online.getName();
        } else {
            @SuppressWarnings("deprecation")
            OfflinePlayer offline = Bukkit.getOfflinePlayer(args[1]);
            if (!offline.hasPlayedBefore()) {
                player.sendMessage(Component.text("Player '" + args[1] + "' has never joined this server.").color(NamedTextColor.RED));
                return;
            }
            targetUuid = offline.getUniqueId();
            if (offline.getName() != null) targetName = offline.getName();
        }

        PetTrustData data = service.get(pet.getUniqueId());
        if (data == null || !data.getTrustedPlayers().containsKey(targetUuid)) {
            player.sendMessage(Component.text(targetName + " is not explicitly trusted on this pet.").color(NamedTextColor.YELLOW));
            return;
        }

        service.removePlayerTrust(pet, targetUuid);
        player.sendMessage(Component.text("Removed trust for ")
            .append(Component.text(targetName).color(NamedTextColor.AQUA))
            .append(Component.text(" from this " + formatType(pet) + "."))
            .color(NamedTextColor.WHITE));
    }

    private void handlePublic(Player player, String[] args) {
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: /pettrust public <ACCESS|MANAGE>").color(NamedTextColor.RED));
            return;
        }

        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can change trust for this pet.");
            return;
        }

        TrustLevel level = TrustLevel.parse(args[1]);
        if (level == null) {
            player.sendMessage(Component.text("Invalid trust level. Valid values: " + TrustLevel.validValues()).color(NamedTextColor.RED));
            return;
        }

        service.setPublicTrust(pet, level);
        player.sendMessage(Component.text("This " + formatType(pet) + " is now ")
            .append(Component.text("PUBLIC").color(NamedTextColor.GREEN))
            .append(Component.text(" — anyone can "))
            .append(Component.text(level.name()).color(NamedTextColor.AQUA))
            .append(Component.text(" it."))
            .color(NamedTextColor.WHITE));
    }

    private void handlePrivate(Player player, String[] args) {
        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can change trust for this pet.");
            return;
        }

        service.disablePublicTrust(pet);
        player.sendMessage(Component.text("This " + formatType(pet) + " is now ")
            .append(Component.text("PRIVATE").color(NamedTextColor.RED))
            .append(Component.text(". Public access removed. Player-specific trust entries remain."))
            .color(NamedTextColor.WHITE));
    }

    private void handleList(Player player) {
        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can view the full trust list.");
            return;
        }

        PetTrustData data = service.get(pet.getUniqueId());

        player.sendMessage(Component.text("══ Pet Trust: " + pet.getType().name() + " ══").color(NamedTextColor.GOLD));
        player.sendMessage(Component.text("UUID: ").color(NamedTextColor.GRAY)
            .append(Component.text(pet.getUniqueId().toString().substring(0, 8) + "…").color(NamedTextColor.DARK_GRAY)));

        if (data == null) {
            player.sendMessage(Component.text("No trust data set yet. Use /pettrust public or /pettrust trust to configure.").color(NamedTextColor.YELLOW));
            return;
        }

        player.sendMessage(Component.text("Owner: ").color(NamedTextColor.GRAY)
            .append(Component.text(data.getOwnerName()).color(NamedTextColor.WHITE)));
        player.sendMessage(Component.text("Public: ").color(NamedTextColor.GRAY)
            .append(data.isPublicEnabled()
                ? Component.text("YES (" + data.getPublicLevel().name() + ")").color(NamedTextColor.GREEN)
                : Component.text("NO").color(NamedTextColor.RED)));

        if (data.getAnchor() != null && data.getAnchor().isEnabled()) {
            AnchorData a = data.getAnchor();
            player.sendMessage(Component.text("Anchor: ").color(NamedTextColor.GRAY)
                .append(Component.text("%.1f, %.1f, %.1f (radius: %.1f)".formatted(
                    a.getX(), a.getY(), a.getZ(), a.getRadius())).color(NamedTextColor.YELLOW)));
        }

        if (data.getTrustedPlayers().isEmpty()) {
            player.sendMessage(Component.text("No individual players trusted.").color(NamedTextColor.GRAY));
        } else {
            player.sendMessage(Component.text("Trusted players:").color(NamedTextColor.GRAY));
            for (PlayerTrustEntry entry : data.getTrustedPlayers().values()) {
                player.sendMessage(Component.text("  ")
                    .append(Component.text(entry.getName()).color(NamedTextColor.AQUA))
                    .append(Component.text(" — ").color(NamedTextColor.GRAY))
                    .append(Component.text(entry.getLevel().name()).color(NamedTextColor.YELLOW)));
            }
        }
    }

    private void handleAnchor(Player player, String[] args) {
        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can anchor this pet.");
            return;
        }

        double radius = 3.0;
        if (args.length >= 2) {
            try {
                radius = Double.parseDouble(args[1]);
                if (radius < 0.5) radius = 0.5;
            } catch (NumberFormatException e) {
                player.sendMessage(Component.text("Invalid radius. Usage: /pettrust anchor [radius]").color(NamedTextColor.RED));
                return;
            }
        }

        Location loc = pet.getLocation();
        String world = loc.getWorld() != null ? loc.getWorld().getName() : "world";
        service.setAnchor(pet, new AnchorData(true, world,
            loc.getX(), loc.getY(), loc.getZ(), loc.getYaw(), loc.getPitch(), radius));

        player.sendMessage(Component.text("Anchor set for this " + formatType(pet)
            + " at %.1f, %.1f, %.1f (radius: %.1f blocks).".formatted(
                loc.getX(), loc.getY(), loc.getZ(), radius))
            .color(NamedTextColor.GREEN));
    }

    private void handleUnanchor(Player player) {
        Entity pet = resolvePetOrWarn(player);
        if (pet == null) return;

        if (!service.canModifyTrust(player, pet)) {
            MessageUtil.send(player, plugin.getConfig(), "notOwner",
                "&cOnly the pet owner can unanchor this pet.");
            return;
        }

        service.removeAnchor(pet);
        player.sendMessage(Component.text("Anchor removed from this " + formatType(pet) + ".").color(NamedTextColor.GREEN));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private @Nullable Entity resolvePetOrWarn(Player player) {
        double range = plugin.getConfig().getDouble("petTrust.targetRange", 6.0);
        Entity pet = PetTargetResolver.resolve(player, range);
        if (pet == null) {
            MessageUtil.send(player, plugin.getConfig(), "noTarget",
                "&cLook at a tamed pet or ride one first.");
        }
        return pet;
    }

    private String formatType(Entity pet) {
        return pet.getType().name().toLowerCase().replace('_', ' ');
    }

    private void sendHelp(Player player) {
        player.sendMessage(Component.text("══ /pettrust Help ══").color(NamedTextColor.GOLD));
        helpLine(player, "/pettrust trust <player> [ACCESS|MANAGE]", "Trust a player on this pet");
        helpLine(player, "/pettrust untrust <player>",               "Remove a player's trust");
        helpLine(player, "/pettrust public <ACCESS|MANAGE>",          "Open pet to everyone");
        helpLine(player, "/pettrust private",                         "Close public access");
        helpLine(player, "/pettrust list",                            "Show trust info");
        helpLine(player, "/pettrust anchor [radius]",                 "Lock pet to current location");
        helpLine(player, "/pettrust unanchor",                        "Remove location lock");
    }

    private void helpLine(Player player, String usage, String desc) {
        player.sendMessage(Component.text(usage).color(NamedTextColor.YELLOW)
            .append(Component.text(" — " + desc).color(NamedTextColor.GRAY)));
    }

    // ── Tab completion ────────────────────────────────────────────────────────

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command,
                                                @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player)) return List.of();

        if (args.length == 1) {
            return filterPrefix(args[0], "trust", "untrust", "public", "private", "list", "anchor", "unanchor", "help");
        }
        if (args.length == 2) {
            return switch (args[0].toLowerCase()) {
                case "trust", "untrust" -> Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(n -> n.toLowerCase().startsWith(args[1].toLowerCase()))
                    .collect(Collectors.toList());
                case "public"  -> filterPrefix(args[1], "ACCESS", "MANAGE");
                case "anchor"  -> filterPrefix(args[1], "3.0", "5.0", "10.0");
                default        -> List.of();
            };
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("trust")) {
            return filterPrefix(args[2], "ACCESS", "MANAGE");
        }
        return List.of();
    }

    private List<String> filterPrefix(String input, String... options) {
        String lower = input.toLowerCase();
        return Arrays.stream(options)
            .filter(o -> o.toLowerCase().startsWith(lower))
            .collect(Collectors.toList());
    }
}
