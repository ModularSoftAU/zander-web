package org.modularsoft.zander.addon.pettrust.util;

import org.bukkit.entity.AnimalTamer;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Tameable;

import java.util.Optional;
import java.util.UUID;

public final class PetOwnershipResolver {
    private PetOwnershipResolver() {}

    public static Optional<UUID> getOwnerUuid(Entity entity) {
        if (!(entity instanceof Tameable t)) return Optional.empty();
        AnimalTamer owner = t.getOwner();
        return owner != null ? Optional.of(owner.getUniqueId()) : Optional.empty();
    }

    public static Optional<String> getOwnerName(Entity entity) {
        if (!(entity instanceof Tameable t)) return Optional.empty();
        AnimalTamer owner = t.getOwner();
        return owner != null ? Optional.ofNullable(owner.getName()) : Optional.empty();
    }
}
