package org.modularsoft.zander.addon.util;

import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;

import java.util.List;

public class PetTargetResolver {
    public static Entity resolvePet(Player player) {
        // 1. Check if mounted
        Entity vehicle = player.getVehicle();
        if (isTamedPet(vehicle)) {
            return vehicle;
        }

        // 2. Ray trace or look at entity
        List<Entity> nearbyEntities = player.getNearbyEntities(5, 5, 5);
        Entity target = player.getTargetEntity(5);
        if (isTamedPet(target)) {
            return target;
        }

        return null;
    }

    private static boolean isTamedPet(Entity entity) {
        if (entity instanceof Tameable tameable) {
            return tameable.isTamed() && tameable.getOwner() != null;
        }
        return false;
    }
}
