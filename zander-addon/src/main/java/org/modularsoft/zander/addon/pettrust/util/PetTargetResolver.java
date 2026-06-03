package org.modularsoft.zander.addon.pettrust.util;

import org.bukkit.Location;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;
import org.bukkit.util.RayTraceResult;

public final class PetTargetResolver {
    private PetTargetResolver() {}

    public static Entity resolve(Player player, double range) {
        // 1. Riding a supported pet takes priority.
        Entity vehicle = player.getVehicle();
        if (isSupported(vehicle)) return vehicle;

        // 2. Ray trace from the player's eye location.
        Location eye = player.getEyeLocation();
        RayTraceResult result = player.getWorld().rayTraceEntities(
            eye,
            eye.getDirection(),
            range,
            0.0,
            entity -> isSupported(entity) && !entity.equals(player)
        );

        return result != null ? result.getHitEntity() : null;
    }

    public static boolean isSupported(Entity entity) {
        if (!(entity instanceof Tameable t)) return false;
        return t.isTamed() && t.getOwner() != null;
    }
}
