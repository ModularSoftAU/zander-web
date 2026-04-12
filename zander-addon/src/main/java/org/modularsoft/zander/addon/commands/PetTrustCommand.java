package org.modularsoft.zander.addon.commands;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.model.pettrust.PetTrust;
import org.modularsoft.zander.addon.model.pettrust.PlayerTrust;
import org.modularsoft.zander.addon.model.pettrust.TrustLevel;
import org.modularsoft.zander.addon.service.PetTrustService;
import org.modularsoft.zander.addon.util.PetTargetResolver;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

public class PetTrustCommand implements CommandExecutor {
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

        String subCommand = args[0].toLowerCase();

        switch (subCommand) {
            case "trust" -> handleTrust(player, args);
            case "untrust" -> handleUntrust(player, args);
            case "public" -> handlePublic(player, args);
            case "private" -> handlePrivate(player, args);
            case "list" -> handleList(player);
            default -> sendHelp(player);
        }

        return true;
    }

    private void handleTrust(Player player, String[] args) {
        if (args.length < 2) {
            player.sendMessage(Component.text("Usage: /pettrust trust <player> [level]").color(NamedTextColor.RED));
            return;
        }

        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwner(player, pet)) {
            player.sendMessage(Component.text("You are not the owner of this pet.").color(NamedTextColor.RED));
            return;
        }

        Player targetPlayer = Bukkit.getPlayer(args[1]);
        if (targetPlayer == null) {
            player.sendMessage(Component.text("Player not found.").color(NamedTextColor.RED));
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
        trustService.setPlayerTrust(trust, targetPlayer, level);
        player.sendMessage(Component.text("Trusted " + targetPlayer.getName() + " with level " + level.name() + " for this pet.").color(NamedTextColor.GREEN));
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

        if (!isOwner(player, pet)) {
            player.sendMessage(Component.text("You are not the owner of this pet.").color(NamedTextColor.RED));
            return;
        }

        // Try to get UUID from online player or just use the name for removal if possible
        // But our storage uses UUID. For simplicity in a real plugin we might need an offline player lookup.
        Player targetPlayer = Bukkit.getPlayer(args[1]);
        UUID targetUuid;
        String targetName;
        if (targetPlayer != null) {
            targetUuid = targetPlayer.getUniqueId();
            targetName = targetPlayer.getName();
        } else {
            // Very basic offline support if we can't find them, though we should ideally use UUIDs everywhere.
            player.sendMessage(Component.text("Player must be online to untrust (simple implementation).").color(NamedTextColor.RED));
            return;
        }

        PetTrust trust = trustService.getOrCreatePetTrust(pet);
        trustService.removePlayerTrust(trust, targetUuid);
        player.sendMessage(Component.text("Untrusted " + targetName + " from this pet.").color(NamedTextColor.GREEN));
    }

    private void handlePublic(Player player, String[] args) {
        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwner(player, pet)) {
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
        player.sendMessage(Component.text("This pet is now PUBLIC with level " + level.name() + ".").color(NamedTextColor.GREEN));
    }

    private void handlePrivate(Player player, String[] args) {
        Entity pet = PetTargetResolver.resolvePet(player);
        if (pet == null) {
            player.sendMessage(Component.text("You must be looking at or riding a tamed pet.").color(NamedTextColor.RED));
            return;
        }

        if (!isOwner(player, pet)) {
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

        PetTrust trust = trustService.getPetTrust(pet.getUniqueId());
        if (trust == null) {
            player.sendMessage(Component.text("This pet has no trust entries.").color(NamedTextColor.YELLOW));
            return;
        }

        player.sendMessage(Component.text("--- Pet Trust Info ---").color(NamedTextColor.GOLD));
        player.sendMessage(Component.text("Type: " + trust.getPetType()).color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("Public: " + (trust.isPublicEnabled() ? "Yes (" + trust.getPublicLevel() + ")" : "No")).color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("Trusted Players:").color(NamedTextColor.YELLOW));
        for (PlayerTrust pt : trust.getTrustedPlayers().values()) {
            player.sendMessage(Component.text("- " + pt.getName() + " (" + pt.getLevel() + ")").color(NamedTextColor.WHITE));
        }
    }

    private boolean isOwner(Player player, Entity entity) {
        if (entity instanceof Tameable tameable) {
            return tameable.getOwner() != null && tameable.getOwner().getUniqueId().equals(player.getUniqueId());
        }
        return false;
    }

    private void sendHelp(Player player) {
        player.sendMessage(Component.text("--- Pet Trust Help ---").color(NamedTextColor.GOLD));
        player.sendMessage(Component.text("/pettrust trust <player> [level] - Trust a player").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust untrust <player> - Untrust a player").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust public [level] - Make pet public").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust private - Make pet private").color(NamedTextColor.YELLOW));
        player.sendMessage(Component.text("/pettrust list - List trust entries for this pet").color(NamedTextColor.YELLOW));
    }
}
