package org.modularsoft.zander.addon;

import lombok.Getter;
<<<<<<< HEAD
=======
import org.bukkit.command.PluginCommand;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.api.PolicyApiServer;
import org.modularsoft.zander.addon.commands.PolicyCommand;
import org.modularsoft.zander.addon.commands.SocialCommand;
import org.modularsoft.zander.addon.events.PlayerEvents;
import org.modularsoft.zander.addon.gui.PolicyGUI;
import org.modularsoft.zander.addon.gui.SocialGUI;
<<<<<<< HEAD
=======
import org.modularsoft.zander.addon.pettrust.commands.PetTrustCommand;
import org.modularsoft.zander.addon.pettrust.listeners.PetTrustDamageListener;
import org.modularsoft.zander.addon.pettrust.listeners.PetTrustInteractListener;
import org.modularsoft.zander.addon.pettrust.listeners.PetTrustInventoryListener;
import org.modularsoft.zander.addon.pettrust.listeners.PetTrustLeashListener;
import org.modularsoft.zander.addon.pettrust.service.PetTrustService;
import org.modularsoft.zander.addon.pettrust.storage.PetTrustRepository;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
import org.modularsoft.zander.addon.service.PolicyService;

public class ZanderAddonMain extends JavaPlugin {
    @Getter
    private static ZanderAddonMain instance;
    @Getter
    private PolicyService policyService;
<<<<<<< HEAD
=======
    @Getter
    private PetTrustService petTrustService;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
    private PolicyApiServer apiServer;

    @Override
    public void onEnable() {
        instance = this;

        saveDefaultConfig();

        this.policyService = new PolicyService(this);

<<<<<<< HEAD
=======
        PetTrustRepository petTrustRepository = new PetTrustRepository(this);
        this.petTrustService = new PetTrustService(this, petTrustRepository);

>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
        if (getConfig().getBoolean("api-server.enabled", true)) {
            this.apiServer = new PolicyApiServer(this);
            this.apiServer.start();
        }

        PolicyGUI policyGUI = new PolicyGUI(this);
        SocialGUI socialGUI = new SocialGUI(this);
        getServer().getPluginManager().registerEvents(policyGUI, this);
        getServer().getPluginManager().registerEvents(socialGUI, this);
        getServer().getPluginManager().registerEvents(new PlayerEvents(this, policyGUI, socialGUI), this);

<<<<<<< HEAD
        getCommand("policy").setExecutor(new PolicyCommand(this, policyService));
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));

=======
        if (getConfig().getBoolean("petTrust.enabled", true)) {
            getServer().getPluginManager().registerEvents(new PetTrustInteractListener(this, petTrustService), this);
            getServer().getPluginManager().registerEvents(new PetTrustDamageListener(this, petTrustService), this);
            getServer().getPluginManager().registerEvents(new PetTrustInventoryListener(this, petTrustService), this);
            getServer().getPluginManager().registerEvents(new PetTrustLeashListener(this, petTrustService), this);
            getLogger().info("PetTrust system enabled.");
        }

        getCommand("policy").setExecutor(new PolicyCommand(this, policyService));
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));

        PluginCommand ptCmd = getCommand("pettrust");
        if (ptCmd != null) {
            PetTrustCommand petTrustCommand = new PetTrustCommand(this, petTrustService);
            ptCmd.setExecutor(petTrustCommand);
            ptCmd.setTabCompleter(petTrustCommand);
        } else {
            getLogger().warning("Could not register /pettrust — check plugin.yml.");
        }

>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
        getLogger().info("Zander Addon has been enabled.");
    }

    @Override
    public void onDisable() {
        if (this.apiServer != null) {
            this.apiServer.stop();
        }
<<<<<<< HEAD
=======
        if (this.petTrustService != null) {
            this.petTrustService.saveAll();
        }
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
        getLogger().info("Zander Addon has been disabled.");
    }
}
