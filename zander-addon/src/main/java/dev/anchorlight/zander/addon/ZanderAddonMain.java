package dev.anchorlight.zander.addon;

import lombok.Getter;
import org.bukkit.plugin.java.JavaPlugin;
import dev.anchorlight.zander.addon.api.PolicyApiServer;
import dev.anchorlight.zander.addon.commands.FreezeCommand;
import dev.anchorlight.zander.addon.commands.PolicyCommand;
import dev.anchorlight.zander.addon.commands.ShopDirectoryCommand;
import dev.anchorlight.zander.addon.commands.SocialCommand;
import dev.anchorlight.zander.addon.dialog.ShopDetailsDialog;
import dev.anchorlight.zander.addon.dialog.ShopDirectoryDialog;
import dev.anchorlight.zander.addon.dialog.ShopSearchResultsDialog;
import dev.anchorlight.zander.addon.events.FreezeEvents;
import dev.anchorlight.zander.addon.events.PlayerEvents;
import dev.anchorlight.zander.addon.events.ShopDirectoryPlayerListener;
import dev.anchorlight.zander.addon.events.StoreCommandEvents;
import dev.anchorlight.zander.addon.gui.PolicyGUI;
import dev.anchorlight.zander.addon.gui.SocialGUI;
import dev.anchorlight.zander.addon.navigation.ShopNavigationService;
import dev.anchorlight.zander.addon.service.BridgeService;
import dev.anchorlight.zander.addon.service.FreezeService;
import dev.anchorlight.zander.addon.service.PolicyService;
import dev.anchorlight.zander.addon.service.StoreCommandService;
import dev.anchorlight.zander.addon.shop.ShopDirectoryConfig;
import dev.anchorlight.zander.addon.shop.ShopDirectoryService;

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
    private ShopDirectoryService shopDirectoryService;
    private ShopNavigationService shopNavigationService;

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

        PolicyCommand policyCommand = new PolicyCommand(this, policyService);
        getCommand("policy").setExecutor(policyCommand);
        getCommand("policy").setTabCompleter(policyCommand);
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));
        getCommand("freeze").setExecutor(new FreezeCommand(freezeService));

        ShopDirectoryConfig shopDirectoryConfig = ShopDirectoryConfig.from(getConfig());
        if (shopDirectoryConfig.enabled()) {
            this.shopDirectoryService = new ShopDirectoryService(this, shopDirectoryConfig);
            if (this.shopDirectoryService.start()) {
                this.shopNavigationService = new ShopNavigationService(this, shopDirectoryConfig, shopDirectoryService);
                this.shopNavigationService.start();

                ShopDirectoryDialog rootDialog = new ShopDirectoryDialog(this, shopDirectoryService, shopNavigationService, shopDirectoryConfig);
                ShopSearchResultsDialog resultsDialog = new ShopSearchResultsDialog(this, shopDirectoryService, shopDirectoryConfig, rootDialog);
                ShopDetailsDialog detailsDialog = new ShopDetailsDialog(this, shopDirectoryService, shopNavigationService, resultsDialog, rootDialog);
                rootDialog.setResultsOpener(resultsDialog::open);
                resultsDialog.setDetailsOpener(detailsDialog::open);

                getServer().getPluginManager().registerEvents(new ShopDirectoryPlayerListener(shopNavigationService), this);
                getCommand("shops").setExecutor(new ShopDirectoryCommand(rootDialog, shopNavigationService));
            } else {
                this.shopDirectoryService = null;
            }
        } else {
            getLogger().info("Shop Directory disabled by configuration.");
        }

        getLogger().info("Zander Addon has been enabled.");
    }

    @Override
    public void onDisable() {
        if (this.apiServer != null) {
            this.apiServer.stop();
        }
        if (this.shopNavigationService != null) {
            this.shopNavigationService.stop();
        }
        if (this.shopDirectoryService != null) {
            this.shopDirectoryService.stop();
        }
        getLogger().info("Zander Addon has been disabled.");
    }
}
