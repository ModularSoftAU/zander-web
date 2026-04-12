package org.modularsoft.zander.addon;

import lombok.Getter;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.api.PolicyApiServer;
import org.modularsoft.zander.addon.commands.PetTrustCommand;
import org.modularsoft.zander.addon.commands.PolicyCommand;
import org.modularsoft.zander.addon.commands.SocialCommand;
import org.modularsoft.zander.addon.events.PetTrustDamageListener;
import org.modularsoft.zander.addon.events.PetTrustInteractListener;
import org.modularsoft.zander.addon.events.PlayerEvents;
import org.modularsoft.zander.addon.gui.PolicyGUI;
import org.modularsoft.zander.addon.gui.SocialGUI;
import org.modularsoft.zander.addon.service.PetTrustService;
import org.modularsoft.zander.addon.service.PolicyService;

public class ZanderAddonMain extends JavaPlugin {
    @Getter
    private static ZanderAddonMain instance;
    @Getter
    private PolicyService policyService;
    @Getter
    private PetTrustService petTrustService;
    private PolicyApiServer apiServer;

    @Override
    public void onEnable() {
        instance = this;

        saveDefaultConfig();

        this.policyService = new PolicyService(this);
        this.petTrustService = new PetTrustService(this);

        if (getConfig().getBoolean("api-server.enabled", true)) {
            this.apiServer = new PolicyApiServer(this);
            this.apiServer.start();
        }

        PolicyGUI policyGUI = new PolicyGUI(this);
        SocialGUI socialGUI = new SocialGUI(this);
        getServer().getPluginManager().registerEvents(policyGUI, this);
        getServer().getPluginManager().registerEvents(socialGUI, this);
        getServer().getPluginManager().registerEvents(new PlayerEvents(this, policyGUI, socialGUI), this);
        getServer().getPluginManager().registerEvents(new PetTrustInteractListener(this, petTrustService), this);
        getServer().getPluginManager().registerEvents(new PetTrustDamageListener(this, petTrustService), this);

        getCommand("policy").setExecutor(new PolicyCommand(this, policyService));
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));
        getCommand("pettrust").setExecutor(new PetTrustCommand(this, petTrustService));

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
