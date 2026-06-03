package org.modularsoft.zander.addon.pettrust.listeners;

import org.bukkit.entity.AbstractHorse;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.inventory.InventoryHolder;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.pettrust.PetAction;
import org.modularsoft.zander.addon.pettrust.service.PetTrustService;
import org.modularsoft.zander.addon.pettrust.util.MessageUtil;

public class PetTrustInventoryListener implements Listener {
    private final ZanderAddonMain plugin;
    private final PetTrustService service;

    public PetTrustInventoryListener(ZanderAddonMain plugin, PetTrustService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInventoryOpen(InventoryOpenEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;

        InventoryHolder holder = event.getInventory().getHolder();
        if (!(holder instanceof AbstractHorse horse)) return;
        if (!service.isSupportedPet(horse)) return;

        if (!(event.getPlayer() instanceof Player player)) return;

        if (!service.canPerform(player, horse, PetAction.INVENTORY)) {
            event.setCancelled(true);
            MessageUtil.send(player, plugin.getConfig(), "noPermission",
                "&cYou are not trusted to do that with this pet.");
        }
    }
}
