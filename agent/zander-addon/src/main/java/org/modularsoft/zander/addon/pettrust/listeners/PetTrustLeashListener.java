package org.modularsoft.zander.addon.pettrust.listeners;

import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerLeashEntityEvent;
import org.bukkit.event.player.PlayerUnleashEntityEvent;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.pettrust.PetAction;
import org.modularsoft.zander.addon.pettrust.service.PetTrustService;
import org.modularsoft.zander.addon.pettrust.util.MessageUtil;

public class PetTrustLeashListener implements Listener {
    private final ZanderAddonMain plugin;
    private final PetTrustService service;

    public PetTrustLeashListener(ZanderAddonMain plugin, PetTrustService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onLeash(PlayerLeashEntityEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;

        Entity entity = event.getEntity();
        if (!service.isSupportedPet(entity)) return;

        Player player = event.getPlayer();
        if (!service.canPerform(player, entity, PetAction.LEASH)) {
            event.setCancelled(true);
            MessageUtil.send(player, plugin.getConfig(), "noPermission",
                "&cYou are not trusted to do that with this pet.");
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onUnleash(PlayerUnleashEntityEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;

        Entity entity = event.getEntity();
        if (!service.isSupportedPet(entity)) return;

        Player player = event.getPlayer();
        if (!service.canPerform(player, entity, PetAction.UNLEASH)) {
            event.setCancelled(true);
            MessageUtil.send(player, plugin.getConfig(), "noPermission",
                "&cYou are not trusted to do that with this pet.");
        }
    }
}
