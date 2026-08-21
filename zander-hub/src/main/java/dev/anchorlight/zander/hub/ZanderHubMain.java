package dev.anchorlight.zander.hub;

import java.io.File;
import java.io.IOException;
import java.util.Objects;
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
import dev.anchorlight.zander.hub.commands.fly;
import dev.anchorlight.zander.hub.events.HubBoosterPlate;
import dev.anchorlight.zander.hub.events.HubPlayerJoin;
import dev.anchorlight.zander.hub.events.HubPlayerJoinChristmas;
import dev.anchorlight.zander.hub.events.HubPlayerLeave;
import dev.anchorlight.zander.hub.events.HubPlayerVoid;
import dev.anchorlight.zander.hub.events.ProxyMessaging;
import dev.anchorlight.zander.hub.gui.HubCompassItem;
import dev.anchorlight.zander.hub.protection.HubCreatureSpawnProtection;
import dev.anchorlight.zander.hub.protection.HubInteractionProtection;
import dev.anchorlight.zander.hub.protection.HubProtection;
import dev.anchorlight.zander.hub.utils.CopyResources;

public class ZanderHubMain extends JavaPlugin {
    public static ZanderHubMain plugin;
    public static ProxyMessaging proxyMessaging;
    private YamlDocument config;

    public void onEnable() {
        plugin = this;

        CopyResources.mirror("welcome.yml");

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

        ConfigurationManager.setupHubLocationsConfig();
        ConfigurationManager.setupMessagesConfig();
        ConfigurationManager.setupMiscConfig();
        ConfigurationManager.setupCompassConfig();
        ConfigurationManager.setupWelcomeFile();

        proxyMessaging = new ProxyMessaging();
        this.getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");
        this.getServer().getMessenger().registerIncomingPluginChannel(this, "BungeeCord", proxyMessaging);

        // Init Message
        TextComponent enabledMessage = Component.empty()
                .color(NamedTextColor.GREEN)
                .append(Component.text("\n\nZander Hub has been enabled.\n"))
                .append(Component.text("Running Version " + plugin.getPluginMeta().getVersion() + "\n"))
                .append(Component.text("GitHub Repository: https://github.com/ModularSoftAU/zander\n"))
                .append(Component.text("Created by Modular Software\n\n", NamedTextColor.DARK_PURPLE));
        getServer().sendMessage(enabledMessage);

        // Event Registry
        PluginManager pluginmanager = this.getServer().getPluginManager();
        pluginmanager.registerEvents(new HubPlayerJoin(this), this);
        pluginmanager.registerEvents(new HubPlayerLeave(this), this);
        pluginmanager.registerEvents(new HubPlayerVoid(this), this);
        pluginmanager.registerEvents(new HubBoosterPlate(this), this);
        pluginmanager.registerEvents(new HubPlayerJoinChristmas(this), this);
        // Hub Protection
        pluginmanager.registerEvents(new HubProtection(this), this);
        pluginmanager.registerEvents(new HubInteractionProtection(this), this);
        pluginmanager.registerEvents(new HubCreatureSpawnProtection(this), this);

        // Item Event Registry
        pluginmanager.registerEvents(new HubCompassItem(), this);

        // Command Registry
        this.getCommand("fly").setExecutor(new fly());
    }

    public YamlDocument getYamlConfig() {
        return config;
    }

    // load defaults from the embedded resource & don't override existing values
    @Override
    public void onDisable() {
    }
}
