package org.modularsoft.zander.hub.hall.events;

import org.bukkit.Material;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.PlayerArmorStandManipulateEvent;
import org.bukkit.event.player.PlayerInteractAtEntityEvent;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;
import org.modularsoft.zander.hub.hall.models.HallAssignment;
import org.modularsoft.zander.hub.hall.models.HallSlot;

public class HallProtection implements Listener {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;

    public HallProtection(ZanderHubMain plugin) {
        this.plugin = plugin;
        this.hallManager = plugin.getHallManager();
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onArmorStandManipulate(PlayerArmorStandManipulateEvent event) {
        if (isHallArmorStand(event.getRightClicked())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onDamage(EntityDamageEvent event) {
        if (event.getEntity() instanceof ArmorStand && isHallArmorStand((ArmorStand) event.getEntity())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInteract(PlayerInteractAtEntityEvent event) {
        if (!(event.getRightClicked() instanceof ArmorStand as)) return;
        if (!isHallArmorStand(as)) return;

        event.setCancelled(true);

        Player player = event.getPlayer();
        if (player.isSneaking() && player.getInventory().getItemInMainHand().getType() == Material.AIR) {
            HallAssignment assignment = hallManager.getAssignmentForPlayer(player.getUniqueId());
            if (assignment != null) {
                // Check if this is their statue
                for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
                    if (slot.getId().equals(assignment.getSlotId())) {
                        if (slot.getLocation().distanceSquared(as.getLocation()) < 0.25) {
                            hallManager.getCustomizationGui().open(player);
                            return;
                        }
                    }
                }
            }
        }
    }

    private boolean isHallArmorStand(org.bukkit.entity.Entity entity) {
        if (!(entity instanceof ArmorStand)) return false;
        for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
            if (slot.getLocation().distanceSquared(entity.getLocation()) < 0.25) {
                return true;
            }
        }
        return false;
    }
}
