package org.modularsoft.zander.hub.hall.events;

import org.bukkit.entity.ArmorStand;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.PlayerArmorStandManipulateEvent;
import org.bukkit.event.player.PlayerInteractAtEntityEvent;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;
import org.modularsoft.zander.hub.hall.models.HallSlot;

public class HallProtection implements Listener {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;

    public HallProtection(ZanderHubMain plugin) {
        this.plugin = plugin;
        this.hallManager = plugin.getHallManager();
    }

    @EventHandler
    public void onArmorStandManipulate(PlayerArmorStandManipulateEvent event) {
        if (isHallArmorStand(event.getRightClicked())) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onDamage(EntityDamageEvent event) {
        if (event.getEntity() instanceof ArmorStand && isHallArmorStand((ArmorStand) event.getEntity())) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onInteract(PlayerInteractAtEntityEvent event) {
        if (event.getRightClicked() instanceof ArmorStand && isHallArmorStand((ArmorStand) event.getRightClicked())) {
            event.setCancelled(true);
        }
    }

    private boolean isHallArmorStand(org.bukkit.entity.Entity entity) {
        if (!(entity instanceof ArmorStand)) return false;
        // Simple check: is there a slot at this location?
        for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
            if (slot.getLocation().distanceSquared(entity.getLocation()) < 0.25) {
                return true;
            }
        }
        return false;
    }
}
