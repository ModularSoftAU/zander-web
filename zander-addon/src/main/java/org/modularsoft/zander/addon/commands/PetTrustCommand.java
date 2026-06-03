package org.modularsoft.zander.addon.commands;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.model.pettrust.PetTrust;
import org.modularsoft.zander.addon.model.pettrust.PlayerTrust;
import org.modularsoft.zander.addon.model.pettrust.TrustLevel;
import org.modularsoft.zander.addon.service.PetTrustService;
import org.modularsoft.zander.addon.util.PetTargetResolver;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public class PetTrustCommand implements CommandExecutor, TabCompleter {
    private static final String PERM_ADMIN = "zander.pettrust.admin";

    private final ZanderAddonMain plugin;
    private final PetTrustService trustService;

    public PetTrustCommand(ZanderAddonMain plugin, PetTrustService trustService) {
        this.plugin = plugin;
        this.trustService = trustService;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("This command can only be used by players.");
            return true;
        }

        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            sendHelp(player);
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "trust"   -> handleTrust(player, args);
            case "untrust" -> handleUntrust(player, args);
            case "public"  -> handlePublic(player, args);
            case "private" -> handlePrivate(player, args);
            case "list"    -> handleList(player);
            default        -> sendHelp(player);
        }
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command,
                                                @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player)) return List.of();

        if (args.length == 1) {
            return filterPrefix(args[0], "trust", "untrust", "public", "private", "list", "help");
        }
        if (args.length == 2 && (args[0].equalsIgnoreCase("trust") || args[0].equalsIgnoreCase("untrust"))) {
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(n -> n.toLowerCase().startsWith(args[1].toLowerCase()))
                    .collect(Collectors.toList());
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("trust")) {
            return filterPrefix(args[2], "ACCESS", "MANAGE");
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("public")) {
            return filterPrefix(args[1], "ACCESS", "MANAGE");
        }
        return List.of();
    }

    private void handleTrust(Player player, String[] args) {
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: /pettrust trust <player> [ACCESS|MANAGE]").color(NamedTextColor.RED));
            return;
        }

        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwnerOrAdmin(player, pet)) {
            player.sendMessage(Component.text("You are not the owner of this pet.").color(NamedTextColor.RED));
            return;
        }

        Player target = Bukkit.getPlayer(args[1]);
        if (target == null) {
            player.sendMessage(Component.text("That player is not online.").color(NamedTextColor.RED));
            return;
        }

        TrustLevel level = TrustLevel.ACCESS;
        if (args.length >= 3) {
            try {
                level = TrustLevel.valueOf(args[2].toUpperCase());
            } catch (IllegalArgumentException e) {
                player.sendMessage(Component.text("Invalid trust level. Use ACCESS or MANAGE.").color(NamedTextColor.RED));
                return;
            }
        }

        PetTrust trust = trustService.getOrCreatePetTrust(pet);
        trustService.setPlayerTrust(trust, target, level);
        player.sendMessage(Component.text("Trusted " + target.getName() + " with level " + level.name() + " for this pet.").color(NamedTextColor.GREEN));
    }

    private void handleUntrust(Player player, String[] args) {
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: /pettrust untrust <player>").color(NamedTextColor.RED));
            return;
        }

        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwnerOrAdmin(player, pet)) {
            player.sendMessage(Component.text("You are not the owner of this pet.").color(NamedTextColor.RED));
            return;
        }

        // Resolve UUID via online lookup first, then fall back to previously seen offline player.
        UUID targetUuid;
        String targetName = args[1];

        Player onlineTarget = Bukkit.getPlayer(args[1]);
        if (onlineTarget != null) {
            targetUuid = onlineTarget.getUniqueId();
            targetName = onlineTarget.getName();
        } else {
            // Paper caches previously-seen player profiles, so getOfflinePlayer by name is safe here.
            @SuppressWarnings("deprecation")
            OfflinePlayer offline = Bukkit.getOfflinePlayer(args[1]);
            if (!offline.hasPlayedBefore()) {
                player.sendMessage(Component.text("Player '" + args[1] + "' has never joined this server.").color(NamedTextColor.RED));
                return;
            }
            targetUuid = offline.getUniqueId();
            targetName = offline.getName() != null ? offline.getName() : args[1];
        }

        PetTrust trust = trustService.getOrCreatePetTrust(pet);
        if (trust == null || !trust.getTrustedPlayers().containsKey(targetUuid)) {
            player.sendMessage(Component.text(targetName + " is not trusted to this pet.").color(NamedTextColor.YELLOW));
            return;
        }

        trustService.removePlayerTrust(trust, targetUuid);
        player.sendMessage(Component.text("Untrusted " + targetName + " from this pet.").color(NamedTextColor.GREEN));
    }

    private void handlePublic(Player player, String[] args) {
        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwnerOrAdmin(player, pet)) {
            player.sendMessage(Component.text("You are not the owner of this pet.").color(NamedTextColor.RED));
            return;
        }

        TrustLevel level = TrustLevel.ACCESS;
        if (args.length >= 2) {
            try {
                level = TrustLevel.valueOf(args[1].toUpperCase());
            } catch (IllegalArgumentException e) {
                player.sendMessage(Component.text("Invalid trust level. Use ACCESS or MANAGE.").color(NamedTextColor.RED));
                return;
            }
        }

        PetTrust trust = trustService.getOrCreatePetTrust(pet);
        trustService.setPublicTrust(trust, true, level);
        player.sendMessage(Component.text("This pet is now PUBLIC (" + level.name() + ").").color(NamedTextColor.GREEN));
    }

    private void handlePrivate(Player player, String[] args) {
        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwnerOrAdmin(player, pet)) {
            player.sendMessage(Component.text("You are not the owner of this pet.").color(NamedTextColor.RED));
            return;
        }

        PetTrust trust = trustService.getOrCreatePetTrust(pet);
        trustService.setPublicTrust(trust, false, TrustLevel.ACCESS);
        player.sendMessage(Component.text("This pet is now PRIVATE.").color(NamedTextColor.GREEN));
    }

    private void handleList(Player player) {
        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwnerOrAdmin(player, pet)) {
            player.sendMessage(Component.text("Only the pet's owner can view the trust list.").color(NamedTextColor.RED));
            return;
        }

        PetTrust trust = trustService.getPetTrust(pet.getUniqueId());
        if (trust == null) {
            player.sendMessage(Component.text("This pet has no trust entries.").color(NamedTextColor.YELLOW));
            return;
        }

        player.sendMessage(Component.text("--- Pet Trust: " + trust.getPetType() + " ---").color(NamedTextColor.GOLD));
        player.sendMessage(Component.text("Public: " + (trust.isPublicEnabled() ? "Yes (" + trust.getPublicLevel() + ")" : "No")).color(NamedTextColor.YELLOW));
        if (trust.getTrustedPlayers().isEmpty()) {
            player.sendMessage(Component.text("No individual players trusted.").color(NamedTextColor.GRAY));
        } else {
            player.sendMessage(Component.text("Trusted players:").color(NamedTextColor.YELLOW));
            for (PlayerTrust pt : trust.getTrustedPlayers().values()) {
                player.sendMessage(Component.text("  " + pt.getName() + " — " + pt.getLevel()).color(NamedTextColor.WHITE));
            }
        }
    }

    private boolean isOwnerOrAdmin(Player player, Entity entity) {
        if (player.hasPermission(PERM_ADMIN)) return true;
        if (entity instanceof Tameable tameable) {
            return tameable.getOwner() != null && tameable.getOwner().getUniqueId().equals(player.getUniqueId());
        }
        return false;
    }

    private void sendHelp(Player player) {
        player.sendMessage(Component.text("--- Pet Trust Help ---").color(NamedTextColor.GOLD));
        player.sendMessage(Component.text("/pettrust trust <player> [ACCESS|MANAGE]").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust untrust <player>").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust public [ACCESS|MANAGE]").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust private").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust list").color(NamedTextColor.YELLOW));
    }

    private List<String> filterPrefix(String input, String... options) {
        String lower = input.toLowerCase();
        return Arrays.stream(options)
                .filter(o -> o.toLowerCase().startsWith(lower))
                .collect(Collectors.toList());
    }
}
