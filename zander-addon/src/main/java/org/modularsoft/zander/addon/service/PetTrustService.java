package org.modularsoft.zander.addon.service;

import org.bukkit.entity.Entity;
import org.bukkit.entity.Tameable;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.model.pettrust.PetTrust;
import org.modularsoft.zander.addon.model.pettrust.PlayerTrust;
import org.modularsoft.zander.addon.model.pettrust.TrustLevel;
import org.modularsoft.zander.addon.storage.PetTrustRepository;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class PetTrustService {
    private final JavaPlugin plugin;
    private final PetTrustRepository repository;
    private final Map<UUID, PetTrust> petTrustCache = new ConcurrentHashMap<>();

    public PetTrustService(JavaPlugin plugin) {
        this.plugin = plugin;
        this.repository = new PetTrustRepository(plugin);
        loadAll();
    }

    private void loadAll() {
        petTrustCache.putAll(repository.loadAll());
    }

    public PetTrust getOrCreatePetTrust(Entity entity) {
        if (!(entity instanceof Tameable tameable)) return null;
        if (!tameable.isTamed() || tameable.getOwner() == null) return null;

        UUID petUuid = entity.getUniqueId();
        PetTrust trust = petTrustCache.get(petUuid);

        if (trust == null) {
            UUID ownerUuid = tameable.getOwner().getUniqueId();
            String ownerName = tameable.getOwner().getName();
            String petType = entity.getType().name();
            trust = new PetTrust(petUuid, ownerUuid, ownerName, petType);
            petTrustCache.put(petUuid, trust);
            saveAsync(trust);
        }
        return trust;
    }

    public PetTrust getPetTrust(UUID petUuid) {
        return petTrustCache.get(petUuid);
    }

    public boolean hasPermission(Player player, Entity entity, TrustLevel requiredLevel) {
        if (!(entity instanceof Tameable tameable)) return true;
        if (!tameable.isTamed() || tameable.getOwner() == null) return true;

        // Owner always has permission
        if (tameable.getOwner().getUniqueId().equals(player.getUniqueId())) return true;

        PetTrust trust = getPetTrust(entity.getUniqueId());
        if (trust == null) return false;

        PlayerTrust playerTrust = trust.getTrustedPlayers().get(player.getUniqueId());
        if (playerTrust != null && playerTrust.getLevel().isAtLeast(requiredLevel)) return true;

        return trust.isPublicEnabled() && trust.getPublicLevel().isAtLeast(requiredLevel);
    }

    public void setPlayerTrust(PetTrust trust, Player player, TrustLevel level) {
        PlayerTrust pt = new PlayerTrust(player.getUniqueId(), player.getName(), level, LocalDateTime.now());
        trust.getTrustedPlayers().put(player.getUniqueId(), pt);
        saveAsync(trust);
    }

    public void removePlayerTrust(PetTrust trust, UUID playerUuid) {
        trust.getTrustedPlayers().remove(playerUuid);
        saveAsync(trust);
    }

    public void setPublicTrust(PetTrust trust, boolean enabled, TrustLevel level) {
        trust.setPublicEnabled(enabled);
        trust.setPublicLevel(level);
        saveAsync(trust);
    }

    private void saveAsync(PetTrust trust) {
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> repository.savePet(trust));
    }
}
