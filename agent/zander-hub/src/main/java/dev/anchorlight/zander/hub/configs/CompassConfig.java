package dev.anchorlight.zander.hub.configs;

import dev.anchorlight.zander.hub.ZanderHubMain;
import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.block.implementation.Section;
import dev.dejvokep.boostedyaml.route.Route;
import org.bukkit.Material;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Manages the Navigation Compass' configured server entries, and their persistence.
 * Handles loading, validation, and access to managed data.
 */
public class CompassConfig {
    private final ZanderHubMain plugin;

    private List<CompassServerEntry> servers = Collections.emptyList();

    public record CompassServerEntry(String id, Material material, String display, String lore) {
    }

    public CompassConfig(ZanderHubMain plugin) {
        this.plugin = plugin;
    }

    /// Configure the Navigation Compass' server entries.
    /// Validates each entry in server 'config.yml', skipping invalid ones with a warning.
    public void setupServers() {
        YamlDocument config = plugin.getYamlConfig();
        Section section = config.getSection(Route.from("compass", "servers"));
        List<CompassServerEntry> parsed = new ArrayList<>();

        if (section == null) {
            plugin.getLogger().warning("Missing 'compass.servers' in config.yml; Navigation Compass will show no servers.");
            this.servers = Collections.emptyList();
            return;
        }

        for (String id : section.getRoutesAsStrings(false)) {
            Section entry = section.getSection(Route.from(id));
            if (entry == null) {
                plugin.getLogger().warning(String.format("Invalid 'compass.servers.%s' entry in config.yml, skipped", id));
                continue;
            }

            String materialName = entry.getString(Route.from("material"));
            String display = entry.getString(Route.from("display"));
            String lore = entry.getString(Route.from("lore"));

            if (materialName == null || display == null || lore == null) {
                plugin.getLogger().warning(String.format(
                        "Incomplete 'compass.servers.%s' entry in config.yml (needs material, display, lore), skipped", id));
                continue;
            }

            Material material = Material.matchMaterial(materialName);
            if (material == null) {
                plugin.getLogger().warning(String.format(
                        "Invalid 'compass.servers.%s.material' value '%s' in config.yml, skipped", id, materialName));
                continue;
            }

            parsed.add(new CompassServerEntry(id, material, display, lore));
        }

        this.servers = Collections.unmodifiableList(parsed);
    }

    /// Retrieve the configured, valid Navigation Compass server entries.
    public List<CompassServerEntry> getServers() {
        return this.servers;
    }
}
