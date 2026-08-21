package dev.anchorlight.zander.hub.configs;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;
import dev.anchorlight.zander.hub.ZanderHubMain;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidBoolean;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidHotbarSlot;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.validateConfig;

/**
 * Manages miscellaneous settings for the plugin, and their persistance.
 * Handles loading, validation, and access to managed data.
 */
public class MiscConfig {
    private final ZanderHubMain plugin;

    private int slotHubCompass; // * default 0
    private boolean alwaysFirstJoin; // * default false

    public MiscConfig(ZanderHubMain plugin) {
        this.plugin = plugin;
    }

    /// Configure the inventory slot for the hub compass.
    /// Validates the entry in server 'config.yml' with fallback.
    public void setupSlotHubCompass() {
        YamlDocument config = plugin.getYamlConfig();
        int fallback = 4;
        Route field = Route.from("misc", "slot_hub_compass");
        validateConfig(config, field, isValidHotbarSlot, fallback);
        saveConfig(config); // * save to external 'config.yml'
        this.slotHubCompass = config.getInt(field);
    }

    /// Configure the setting for "always trigger first join".
    /// Validates the entry in server 'config.yml' with fallback.
    public void setupAlwaysFirstJoin() {
        YamlDocument config = plugin.getYamlConfig();
        boolean fallback = false;
        Route field = Route.from("misc", "always_first_join");
        validateConfig(config, field, isValidBoolean, fallback);
        saveConfig(config); // * save to external 'config.yml'
        this.alwaysFirstJoin = config.getBoolean(field);
    }

    /// Persist `config` to disk, logging (not throwing) on failure.
    private void saveConfig(YamlDocument config) {
        try {
            config.save();
        } catch (java.io.IOException e) {
            plugin.getLogger().warning("Failed to save config.yml: " + e.getMessage());
        }
    }

    /// Get the inventory slot for the hub compass.
    public int getSlotHubCompass() {
        return this.slotHubCompass;
    }

    /// Get the setting for "always trigger first join".
    public boolean getAlwaysFirstJoin() {
        return this.alwaysFirstJoin;
    }
}
