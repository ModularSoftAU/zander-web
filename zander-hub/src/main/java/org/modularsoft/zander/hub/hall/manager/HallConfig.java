package org.modularsoft.zander.hub.hall.manager;

import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.modularsoft.zander.hub.ZanderHubMain;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class HallConfig {
    private final ZanderHubMain plugin;
    private boolean enabled;
    private int refreshIntervalMinutes;
    private List<Material> allowedMaterials;
    private boolean debug;

    public HallConfig(ZanderHubMain plugin) {
        this.plugin = plugin;
        load();
    }

    public void load() {
        FileConfiguration config = plugin.getConfig();
        this.enabled = config.getBoolean("hall.enabled", true);
        this.refreshIntervalMinutes = config.getInt("hall.refresh-interval", 30);
        this.debug = config.getBoolean("hall.debug", false);

        List<String> materials = config.getStringList("hall.allowed-materials");
        if (materials.isEmpty()) {
            this.allowedMaterials = new ArrayList<>();
            // Add some defaults if empty
            this.allowedMaterials.add(Material.IRON_CHESTPLATE);
            this.allowedMaterials.add(Material.GOLDEN_CHESTPLATE);
            this.allowedMaterials.add(Material.DIAMOND_CHESTPLATE);
            this.allowedMaterials.add(Material.NETHERITE_CHESTPLATE);
            this.allowedMaterials.add(Material.LEATHER_CHESTPLATE);
        } else {
            this.allowedMaterials = materials.stream()
                    .map(s -> {
                        try {
                            return Material.valueOf(s.toUpperCase());
                        } catch (IllegalArgumentException e) {
                            return null;
                        }
                    })
                    .filter(m -> m != null)
                    .collect(Collectors.toList());
        }
    }

    public boolean isEnabled() { return enabled; }
    public int getRefreshIntervalMinutes() { return refreshIntervalMinutes; }
    public List<Material> getAllowedMaterials() { return allowedMaterials; }
    public boolean isDebug() { return debug; }
}
