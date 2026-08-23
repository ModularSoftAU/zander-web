package dev.anchorlight.zander.hub;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.java.JavaPlugin;
import dev.anchorlight.zander.hub.bridge.BridgeClient;
import dev.anchorlight.zander.hub.commands.fly;
import dev.anchorlight.zander.hub.commands.portal.PortalCommand;
import dev.anchorlight.zander.hub.commands.portal.PortalSelectionManager;
import dev.anchorlight.zander.hub.commands.portal.PortalWandListener;
import dev.anchorlight.zander.hub.events.HubBoosterPlate;
import dev.anchorlight.zander.hub.events.HubPlayerJoin;
import dev.anchorlight.zander.hub.events.HubPlayerJoinChristmas;
import dev.anchorlight.zander.hub.events.HubPlayerLeave;
import dev.anchorlight.zander.hub.events.HubPlayerVoid;
import dev.anchorlight.zander.hub.gui.HubCompassItem;
import dev.anchorlight.zander.hub.portal.PortalActivationHandler;
import dev.anchorlight.zander.hub.portal.PortalMovementListener;
import dev.anchorlight.zander.hub.portal.PortalRepository;
import dev.anchorlight.zander.hub.portal.PortalService;
import dev.anchorlight.zander.hub.portal.PortalSessionManager;
import dev.anchorlight.zander.hub.portal.PortalSpatialIndex;
import dev.anchorlight.zander.hub.portal.PortalTransitionDetector;
import dev.anchorlight.zander.hub.protection.HubCreatureSpawnProtection;
import dev.anchorlight.zander.hub.protection.HubInteractionProtection;
import dev.anchorlight.zander.hub.protection.HubProtection;
import dev.anchorlight.zander.hub.protection.dimension.DimensionProtectionListener;
import dev.anchorlight.zander.hub.utils.CopyResources;

import java.io.File;

public class ZanderHubMain extends JavaPlugin {
    public static ZanderHubMain plugin;
    public static BridgeClient bridgeClient;
    public static PortalService portalService;
    public static PortalSessionManager portalSessions;

    public void onEnable() {
        plugin = this;

        CopyResources.mirror("config.yml");
        CopyResources.mirror("welcome.yml");

        ConfigurationManager.setupHubLocationsConfig();
        ConfigurationManager.setupMessagesConfig();
        ConfigurationManager.setupMiscConfig();
        ConfigurationManager.setupDimensionsConfig();
        ConfigurationManager.setupCompassConfig();
        ConfigurationManager.setupWelcomeFile();

        // Zander proxy bridge
        this.getServer().getMessenger().registerOutgoingPluginChannel(this, "zander:hub");
        bridgeClient = new BridgeClient((player, bytes) -> player.sendPluginMessage(this, "zander:hub", bytes), 1500L);
        this.getServer().getMessenger().registerIncomingPluginChannel(this, "zander:hub",
                (channel, player, message) -> bridgeClient.onPluginMessageReceived(message));

        // Portal system
        File portalsFile = new File(getDataFolder(), "portals.yml");
        PortalRepository portalRepository = new PortalRepository(portalsFile, getLogger(),
                worldName -> Bukkit.getWorld(worldName) != null);
        PortalSpatialIndex portalIndex = new PortalSpatialIndex();
        portalService = new PortalService(portalRepository, portalIndex);
        getLogger().info("Loaded " + portalService.all().size() + " portal(s).");

        portalSessions = new PortalSessionManager();
        PortalTransitionDetector transitionDetector = new PortalTransitionDetector(portalIndex, portalSessions);
        PortalActivationHandler activationHandler = new PortalActivationHandler(this, portalSessions, bridgeClient);
        PortalSelectionManager selections = new PortalSelectionManager();

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
        pluginmanager.registerEvents(new DimensionProtectionListener(this), this);

        // Item Event Registry
        pluginmanager.registerEvents(new HubCompassItem(), this);
        pluginmanager.registerEvents(new PortalWandListener(selections), this);
        pluginmanager.registerEvents(new PortalMovementListener(this, transitionDetector, portalSessions, activationHandler), this);

        // Command Registry
        this.getCommand("fly").setExecutor(new fly());
        this.getCommand("zportal").setExecutor(new PortalCommand(portalService, selections));
        this.getCommand("zportal").setTabCompleter(new PortalCommand(portalService, selections));
    }

    @Override
    public void onDisable() {
        Bukkit.getScheduler().cancelTasks(this);
        if (bridgeClient != null) {
            this.getServer().getMessenger().unregisterIncomingPluginChannel(this, "zander:hub");
            this.getServer().getMessenger().unregisterOutgoingPluginChannel(this, "zander:hub");
        }
        bridgeClient = null;
        portalService = null;
        portalSessions = null;
        plugin = null;
    }
}
