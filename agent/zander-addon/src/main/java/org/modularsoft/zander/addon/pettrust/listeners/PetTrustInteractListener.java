package org.modularsoft.zander.addon.pettrust.listeners;

import org.bukkit.entity.AbstractHorse;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.pettrust.PetAction;
import org.modularsoft.zander.addon.pettrust.service.PetTrustService;
import org.modularsoft.zander.addon.pettrust.util.MessageUtil;

public class PetTrustInteractListener implements Listener {
    private final ZanderAddonMain plugin;
    private final PetTrustService service;

    public PetTrustInteractListener(ZanderAddonMain plugin, PetTrustService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInteract(PlayerInteractEntityEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;

        Entity entity = event.getRightClicked();
        if (!service.isSupportedPet(entity)) return;

        Player player = event.getPlayer();

        // Sneaking + horse = opening inventory/saddle; treat as INVENTORY action.
        PetAction action = (player.isSneaking() && entity instanceof AbstractHorse)
            ? PetAction.INVENTORY
            : PetAction.USE;

        if (!service.canPerform(player, entity, action)) {
            event.setCancelled(true);
            MessageUtil.send(player, plugin.getConfig(), "noPermission",
                "&cYou are not trusted to do that with this pet.");
        }
    }
}
