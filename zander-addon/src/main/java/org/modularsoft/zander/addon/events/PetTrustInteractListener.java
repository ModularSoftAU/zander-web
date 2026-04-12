package org.modularsoft.zander.addon.events;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.model.pettrust.TrustLevel;
import org.modularsoft.zander.addon.service.PetTrustService;

public class PetTrustInteractListener implements Listener {
    private final ZanderAddonMain plugin;
    private final PetTrustService trustService;

    public PetTrustInteractListener(ZanderAddonMain plugin, PetTrustService trustService) {
        this.plugin = plugin;
        this.trustService = trustService;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onPetInteract(PlayerInteractEntityEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;

        Entity entity = event.getRightClicked();
        if (!(entity instanceof Tameable tameable) || !tameable.isTamed() || tameable.getOwner() == null) return;

        Player player = event.getPlayer();
        if (player.hasPermission("zander.pettrust.bypass")) return;

        // Check for ACCESS level for interaction (mounting, etc.)
        if (!trustService.hasPermission(player, entity, TrustLevel.ACCESS)) {
            event.setCancelled(true);
            String message = plugin.getConfig().getString("petTrust.noPermissionMessage", "&cYou are not trusted to use this pet.");
            player.sendMessage(Component.text(message.replace("&", "§")).color(NamedTextColor.RED));
        }
    }
}
