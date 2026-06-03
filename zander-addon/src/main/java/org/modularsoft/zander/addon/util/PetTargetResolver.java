package org.modularsoft.zander.addon.util;

import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;

public class PetTargetResolver {
    public static Entity resolvePet(Player player) {
        Entity vehicle = player.getVehicle();
        if (isTamedPet(vehicle)) {
            return vehicle;
        }

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
