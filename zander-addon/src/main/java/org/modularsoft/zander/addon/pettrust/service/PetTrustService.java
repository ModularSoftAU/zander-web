package org.modularsoft.zander.addon.pettrust.service;

import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.pettrust.PetAction;
import org.modularsoft.zander.addon.pettrust.TrustLevel;
import org.modularsoft.zander.addon.pettrust.model.AnchorData;
import org.modularsoft.zander.addon.pettrust.model.PetTrustData;
import org.modularsoft.zander.addon.pettrust.model.PlayerTrustEntry;
import org.modularsoft.zander.addon.pettrust.storage.PetTrustRepository;
import org.modularsoft.zander.addon.pettrust.util.PetOwnershipResolver;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class PetTrustService {
    private static final String PERM_BYPASS = "zanderaddon.pettrust.bypass";
    private static final String PERM_ADMIN  = "zanderaddon.pettrust.admin";

    private final JavaPlugin plugin;
    private final PetTrustRepository repository;
    private final Map<UUID, PetTrustData> cache = new ConcurrentHashMap<>();

    public PetTrustService(JavaPlugin plugin, PetTrustRepository repository) {
        this.plugin = plugin;
        this.repository = repository;
        cache.putAll(repository.loadAll());

        // Enforce anchors every 40 ticks (2 seconds).
        plugin.getServer().getScheduler().runTaskTimer(plugin, this::enforceAnchors, 40L, 40L);
    }

    // ── Support ──────────────────────────────────────────────────────────────

    public boolean isSupportedPet(Entity entity) {
        if (!(entity instanceof Tameable t)) return false;
        return t.isTamed() && t.getOwner() != null;
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    public Optional<UUID> getOwnerUuid(Entity entity) {
        return PetOwnershipResolver.getOwnerUuid(entity);
    }

    public boolean isOwner(Player player, Entity pet) {
        return getOwnerUuid(pet).map(u -> u.equals(player.getUniqueId())).orElse(false);
    }

    public boolean canModifyTrust(Player player, Entity pet) {
        return isOwner(player, pet) || player.hasPermission(PERM_ADMIN);
    }

    // ── Trust resolution ─────────────────────────────────────────────────────

    /**
     * Returns the effective trust level for the player on this pet.
     * Uses the highest level from explicit per-player trust and public trust.
     * Returns null if the player has no trust at all.
     */
    public TrustLevel getEffectiveTrustLevel(Player player, Entity pet) {
        if (isOwner(player, pet)) return TrustLevel.MANAGE;
        if (player.hasPermission(PERM_BYPASS)) return TrustLevel.MANAGE;

        PetTrustData data = cache.get(pet.getUniqueId());
        if (data == null) return null;

        TrustLevel effective = null;

        PlayerTrustEntry entry = data.getTrustedPlayers().get(player.getUniqueId());
        if (entry != null) effective = entry.getLevel();

        if (data.isPublicEnabled()) {
            TrustLevel pub = data.getPublicLevel();
            if (effective == null || pub.isAtLeast(effective)) effective = pub;
        }

        return effective;
    }

    public boolean canPerform(Player player, Entity pet, PetAction action) {
        if (!isSupportedPet(pet)) return true;
        if (isOwner(player, pet)) return true;
        if (player.hasPermission(PERM_BYPASS)) return true;

        TrustLevel effective = getEffectiveTrustLevel(player, pet);
        return effective != null && effective.isAtLeast(action.getRequiredLevel());
    }

    // ── Data access ───────────────────────────────────────────────────────────

    public PetTrustData getOrCreate(Entity pet) {
        if (!(pet instanceof Tameable t) || !t.isTamed() || t.getOwner() == null) return null;

        return cache.computeIfAbsent(pet.getUniqueId(), uuid -> {
            PetTrustData data = new PetTrustData(
                uuid,
                t.getOwner().getUniqueId(),
                t.getOwner().getName() != null ? t.getOwner().getName() : "Unknown",
                pet.getType().name()
            );
            repository.savePet(data);
            repository.save();
            return data;
        });
    }

    public PetTrustData get(UUID petUuid) {
        return cache.get(petUuid);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    public void setPlayerTrust(Entity pet, Player trustedPlayer, TrustLevel level) {
        PetTrustData data = getOrCreate(pet);
        if (data == null) return;

        OffsetDateTime now = OffsetDateTime.now();
        PlayerTrustEntry existing = data.getTrustedPlayers().get(trustedPlayer.getUniqueId());
        OffsetDateTime addedAt = existing != null ? existing.getAddedAt() : now;

        data.getTrustedPlayers().put(
            trustedPlayer.getUniqueId(),
            new PlayerTrustEntry(trustedPlayer.getUniqueId(), trustedPlayer.getName(), level, addedAt, now)
        );
        persist(data);
    }

    public void removePlayerTrust(Entity pet, UUID uuid) {
        PetTrustData data = get(pet.getUniqueId());
        if (data == null) return;
        data.getTrustedPlayers().remove(uuid);
        persist(data);
    }

    public void setPublicTrust(Entity pet, TrustLevel level) {
        PetTrustData data = getOrCreate(pet);
        if (data == null) return;
        data.setPublicEnabled(true);
        data.setPublicLevel(level);
        persist(data);
    }

    public void disablePublicTrust(Entity pet) {
        PetTrustData data = get(pet.getUniqueId());
        if (data == null) return;
        data.setPublicEnabled(false);
        persist(data);
    }

    public void setAnchor(Entity pet, AnchorData anchor) {
        PetTrustData data = getOrCreate(pet);
        if (data == null) return;
        data.setAnchor(anchor);
        persist(data);
    }

    public void removeAnchor(Entity pet) {
        PetTrustData data = get(pet.getUniqueId());
        if (data == null) return;
        data.setAnchor(null);
        persist(data);
    }

    public void updateLocationMetadata(Entity pet) {
        PetTrustData data = cache.get(pet.getUniqueId());
        if (data == null || pet.getLocation().getWorld() == null) return;
        Location loc = pet.getLocation();
        data.setLastKnownWorld(loc.getWorld().getName());
        data.setLastKnownX(loc.getX());
        data.setLastKnownY(loc.getY());
        data.setLastKnownZ(loc.getZ());
        persist(data);
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    private void persist(PetTrustData data) {
        repository.savePet(data);
        repository.save();
    }

    public void saveAll() {
        repository.save();
    }

    // ── Anchor enforcement ────────────────────────────────────────────────────

    private void enforceAnchors() {
        for (PetTrustData data : cache.values()) {
            AnchorData anchor = data.getAnchor();
            if (anchor == null || !anchor.isEnabled()) continue;

            World world = plugin.getServer().getWorld(anchor.getWorld());
            if (world == null) continue;

            Entity pet = world.getEntity(data.getPetUuid());
            if (pet == null || pet.isDead()) continue;

            Location anchorLoc = new Location(world, anchor.getX(), anchor.getY(), anchor.getZ(),
                anchor.getYaw(), anchor.getPitch());

            if (pet.getLocation().distanceSquared(anchorLoc) > anchor.getRadius() * anchor.getRadius()) {
                pet.teleport(anchorLoc);
            }
        }
    }
}
