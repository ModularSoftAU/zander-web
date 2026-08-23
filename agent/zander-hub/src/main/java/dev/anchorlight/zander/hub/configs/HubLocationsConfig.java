package dev.anchorlight.zander.hub.configs;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;
import dev.anchorlight.zander.hub.ZanderHubMain;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidDouble;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidPitch;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidWorld;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidYaw;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.validateConfig;

/**
 * Manages hub locations for the plugin, and their persistence.
 * Handles loading, validation, and access to managed data.
 */
public class HubLocationsConfig {
    private final ZanderHubMain plugin;

    private Location locationSpawn;
    // future? private Location locationParkour;

    public HubLocationsConfig(ZanderHubMain plugin) {
        this.plugin = plugin;
    }

    /// Configure the hub spawn location.
    /// Validates the entries in server 'config.yml' with fallback.
    public void setupSpawn() {
        YamlDocument config = plugin.getYamlConfig();

        // * access server's primary world (guaranteed by Bukkit to exist)
        Location defaultSpawn = Bukkit.getServer().getWorlds().get(0).getSpawnLocation();

        Route fieldWorld = Route.from("hub", "world");
        Route fieldX = Route.from("hub", "x");
        Route fieldY = Route.from("hub", "y");
        Route fieldZ = Route.from("hub", "z");
        Route fieldPitch = Route.from("hub", "pitch");
        Route fieldYaw = Route.from("hub", "yaw");

        validateConfig(config, fieldWorld, isValidWorld, defaultSpawn.getWorld().getName());
        validateConfig(config, fieldX, isValidDouble, defaultSpawn.getX());
        validateConfig(config, fieldY, isValidDouble, defaultSpawn.getY());
        validateConfig(config, fieldZ, isValidDouble, defaultSpawn.getZ());
        validateConfig(config, fieldPitch, isValidPitch, defaultSpawn.getPitch());
        validateConfig(config, fieldYaw, isValidYaw, defaultSpawn.getYaw());

        try {
            config.save(); // * save to external 'config.yml'
        } catch (java.io.IOException e) {
            plugin.getLogger().warning("Failed to save config.yml: " + e.getMessage());
        }

        World hubWorld = Bukkit.getWorld(config.getString(fieldWorld));
        double hubX = config.getDouble(fieldX);
        double hubY = config.getDouble(fieldY);
        double hubZ = config.getDouble(fieldZ);
        float hubYaw = config.getDouble(fieldYaw).floatValue();
        float hubPitch = config.getDouble(fieldPitch).floatValue();
        this.locationSpawn = new Location(hubWorld, hubX, hubY, hubZ, hubYaw, hubPitch);
    }

    /// Retrieve the hub spawn location.
    public Location getSpawn() {
        if (this.locationSpawn == null)
            throw new IllegalStateException("Missing setup, first run 'HubLocationsConfig.setupSpawn'");
        return this.locationSpawn.clone();
    }
}
