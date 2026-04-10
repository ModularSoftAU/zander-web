package org.modularsoft.zander.hub.hall.services;

import org.bukkit.Material;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;
import org.modularsoft.zander.hub.hall.models.HallCustomization;
import org.modularsoft.zander.hub.hall.persistence.CustomizationPersistence;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class CustomizationService {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;
    private final CustomizationPersistence persistence;
    private final Map<UUID, HallCustomization> cache = new HashMap<>();

    public CustomizationService(ZanderHubMain plugin, HallManager hallManager) {
        this.plugin = plugin;
        this.hallManager = hallManager;
        this.persistence = new CustomizationPersistence(plugin);
    }

    public HallCustomization getCustomization(UUID uuid) {
        if (cache.containsKey(uuid)) return cache.get(uuid);
        HallCustomization c = persistence.load(uuid);
        if (c != null) cache.put(uuid, c);
        return c;
    }

    public void saveCustomization(HallCustomization c) {
        cache.put(c.getPlayerUuid(), c);
        persistence.save(c);

        // Trigger re-render if they have an active assignment
        if (hallManager.getAssignmentForPlayer(c.getPlayerUuid()) != null) {
            hallManager.getRenderService().renderAll();
        }
    }

    public boolean isValidMaterial(Material m) {
        return hallManager.getHallConfig().getAllowedMaterials().contains(m) || m == Material.AIR;
    }
}
