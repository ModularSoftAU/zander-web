package dev.anchorlight.zander.auth;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.dvs.versioning.BasicVersioning;
import dev.dejvokep.boostedyaml.settings.dumper.DumperSettings;
import dev.dejvokep.boostedyaml.settings.general.GeneralSettings;
import dev.dejvokep.boostedyaml.settings.loader.LoaderSettings;
import dev.dejvokep.boostedyaml.settings.updater.UpdaterSettings;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.java.JavaPlugin;
import dev.anchorlight.zander.auth.events.AuthPlayerJoin;
import dev.anchorlight.zander.auth.events.UserOnServerPing;

import java.io.File;
import java.io.IOException;
import java.util.Objects;

public class ZanderAuthMain extends JavaPlugin {
    public static ZanderAuthMain plugin;
    private YamlDocument config;

    public void onEnable() {
        plugin = this;

        try {
            config = YamlDocument.create(new File(getDataFolder(), "config.yml"),
                    Objects.requireNonNull(getResource("config.yml")),
                    GeneralSettings.DEFAULT,
                    LoaderSettings.builder().setAutoUpdate(true).build(),
                    DumperSettings.DEFAULT,
                    UpdaterSettings.builder()
                            .setVersioning(new BasicVersioning("config-version"))
                            .setOptionSorting(UpdaterSettings.OptionSorting.SORT_BY_DEFAULTS)
                            .build());
            config.update();
            config.save();
        } catch (IOException e) {
            getLogger().severe("Could not create or load plugin configuration: " + e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        // Init Message
        TextComponent enabledMessage = Component.empty()
                .color(NamedTextColor.GREEN)
                .append(Component.text("\n\nZander Auth has been enabled.\n"))
                .append(Component.text("Running Version " + plugin.getDescription().getVersion() + "\n"))
                .append(Component.text("GitHub Repository: https://github.com/ModularSoftAU/zander\n"))
                .append(Component.text("Created by Modular Software\n\n", NamedTextColor.DARK_PURPLE));
        getServer().sendMessage(enabledMessage);

        // Event Registry
        PluginManager pluginmanager = this.getServer().getPluginManager();
        pluginmanager.registerEvents(new AuthPlayerJoin(this), this);
        pluginmanager.registerEvents(new UserOnServerPing(), this);
    }

    public YamlDocument getYamlConfig() {
        return config;
    }

    @Override
    public void onDisable() {}
}
