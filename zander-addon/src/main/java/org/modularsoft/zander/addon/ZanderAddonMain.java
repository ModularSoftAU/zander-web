package org.modularsoft.zander.addon;

import lombok.Getter;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.api.PolicyApiServer;
import org.modularsoft.zander.addon.commands.FreezeCommand;
import org.modularsoft.zander.addon.commands.PolicyCommand;
import org.modularsoft.zander.addon.commands.SocialCommand;
import org.modularsoft.zander.addon.events.FreezeEvents;
import org.modularsoft.zander.addon.events.PlayerEvents;
import org.modularsoft.zander.addon.events.StoreCommandEvents;
import org.modularsoft.zander.addon.gui.PolicyGUI;
import org.modularsoft.zander.addon.gui.SocialGUI;
import org.modularsoft.zander.addon.service.BridgeService;
import org.modularsoft.zander.addon.service.FreezeService;
import org.modularsoft.zander.addon.service.PolicyService;
import org.modularsoft.zander.addon.service.StoreCommandService;

public class ZanderAddonMain extends JavaPlugin {
    @Getter
    private static ZanderAddonMain instance;
    @Getter
    private PolicyService policyService;
    @Getter
    private FreezeService freezeService;
    @Getter
    private StoreCommandService storeCommandService;
    @Getter
    private BridgeService bridgeService;
    private PolicyApiServer apiServer;

    @Override
    public void onEnable() {
        instance = this;

        saveDefaultConfig();

        this.policyService = new PolicyService(this);
        this.freezeService = new FreezeService();
        this.storeCommandService = new StoreCommandService(this);
        this.bridgeService = new BridgeService(this);

        if (getConfig().getBoolean("api-server.enabled", false)) {
            this.apiServer = new PolicyApiServer(this);
            this.apiServer.start();
        }

        PolicyGUI policyGUI = new PolicyGUI(this);
        SocialGUI socialGUI = new SocialGUI(this);
        getServer().getPluginManager().registerEvents(policyGUI, this);
        getServer().getPluginManager().registerEvents(socialGUI, this);
        getServer().getPluginManager().registerEvents(new PlayerEvents(this, policyGUI, socialGUI), this);
        getServer().getPluginManager().registerEvents(new FreezeEvents(freezeService), this);

        if (getConfig().getBoolean("command-bridge.enabled", true)) {
            storeCommandService.start();
            getServer().getPluginManager().registerEvents(new StoreCommandEvents(storeCommandService), this);
            getLogger().info("Command bridge enabled for server: " + getConfig().getString("server-name", "survival"));
        }

        if (getConfig().getBoolean("bridge.enabled", true)) {
            bridgeService.start();
            getLogger().info("Bridge processor enabled for server: " + getConfig().getString("server-name", "survival"));
        }

        getCommand("policy").setExecutor(new PolicyCommand(this, policyService));
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));
        getCommand("freeze").setExecutor(new FreezeCommand(freezeService));

        getLogger().info("Zander Addon has been enabled.");
    }

    @Override
    public void onDisable() {
        if (this.apiServer != null) {
            this.apiServer.stop();
        }
        getLogger().info("Zander Addon has been disabled.");
    }
}
