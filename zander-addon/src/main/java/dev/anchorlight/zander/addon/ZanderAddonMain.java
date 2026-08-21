package dev.anchorlight.zander.addon;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.dvs.versioning.BasicVersioning;
import dev.dejvokep.boostedyaml.route.Route;
import dev.dejvokep.boostedyaml.settings.dumper.DumperSettings;
import dev.dejvokep.boostedyaml.settings.general.GeneralSettings;
import dev.dejvokep.boostedyaml.settings.loader.LoaderSettings;
import dev.dejvokep.boostedyaml.settings.updater.UpdaterSettings;
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

import java.io.File;
import java.io.IOException;
import java.util.Objects;

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
    private YamlDocument config;

    @Override
    public void onEnable() {
        instance = this;

        saveDefaultConfig();

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

        this.policyService = new PolicyService(this);
        this.freezeService = new FreezeService();
        this.storeCommandService = new StoreCommandService(this);
        this.bridgeService = new BridgeService(this);

        if (config.getBoolean(Route.from("api-server", "enabled"), false)) {
            this.apiServer = new PolicyApiServer(this);
            this.apiServer.start();
        }

        PolicyGUI policyGUI = new PolicyGUI(this);
        SocialGUI socialGUI = new SocialGUI(this);
        getServer().getPluginManager().registerEvents(policyGUI, this);
        getServer().getPluginManager().registerEvents(socialGUI, this);
        getServer().getPluginManager().registerEvents(new PlayerEvents(this, policyGUI, socialGUI), this);
        getServer().getPluginManager().registerEvents(new FreezeEvents(freezeService), this);

        if (config.getBoolean(Route.from("command-bridge", "enabled"), true)) {
            storeCommandService.start();
            getServer().getPluginManager().registerEvents(new StoreCommandEvents(storeCommandService), this);
            getLogger().info("Command bridge enabled for server: " + config.getString(Route.from("server-name"), "survival"));
        }

        if (config.getBoolean(Route.from("bridge", "enabled"), true)) {
            bridgeService.start();
            getLogger().info("Bridge processor enabled for server: " + config.getString(Route.from("server-name"), "survival"));
        }

        PolicyCommand policyCommand = new PolicyCommand(this, policyService);
        getCommand("policy").setExecutor(policyCommand);
        getCommand("policy").setTabCompleter(policyCommand);
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));
        getCommand("freeze").setExecutor(new FreezeCommand(freezeService));

        ShopDirectoryConfig shopDirectoryConfig = ShopDirectoryConfig.from(config);
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

    public YamlDocument getYamlConfig() {
        return config;
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
