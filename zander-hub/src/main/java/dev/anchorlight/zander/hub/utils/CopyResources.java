package dev.anchorlight.zander.hub.utils;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.logging.Level;
import java.io.InputStreamReader;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import dev.anchorlight.zander.hub.ZanderHubMain;

/**
 * Utility class for doing respectful copies of resources to server environment.
 */
public final class CopyResources {
    private static final JavaPlugin plugin = ZanderHubMain.plugin;

    private CopyResources() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    /// Mirror hierarchy and fields from embedded file at 'resources/<filepath>'.
    /// Server environment will have a corresponding file in plugins data folder.
    public static void mirror(String filepath) {
        InputStream resource = plugin.getResource(filepath);

        if (resource == null) {
            plugin.getLogger().warning(String.format("Missing resource '%s'", filepath));
            return;
        }

        File targetFile = new File(plugin.getDataFolder(), filepath);

        targetFile.getParentFile().mkdirs(); // * create any parent directories

        InputStreamReader reader = new InputStreamReader(resource);
        FileConfiguration serverConf = YamlConfiguration.loadConfiguration(targetFile);
        FileConfiguration templateConf = YamlConfiguration.loadConfiguration(reader);

        try {
            reader.close();
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, String.format("Could not close reader for '%s'", filepath), e);
        }

        serverConf.setDefaults(templateConf);
        serverConf.options().copyDefaults(true);

        try {
            serverConf.save(targetFile);
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, String.format("Could not save '%s'", filepath), e);
        }
    }
}
