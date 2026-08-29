package org.modularsoft.zander.addon;

import lombok.Getter;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.commands.PolicyCommand;
import org.modularsoft.zander.addon.commands.SocialCommand;
import org.modularsoft.zander.addon.events.PlayerEvents;
import org.modularsoft.zander.addon.events.VoteRewardListener;
import org.modularsoft.zander.addon.gui.PolicyGUI;
import org.modularsoft.zander.addon.gui.SocialGUI;
import org.modularsoft.zander.addon.service.BridgeService;
import org.modularsoft.zander.addon.service.ExecutorBridgeTask;
import org.modularsoft.zander.addon.service.PolicyService;

public class ZanderAddonMain extends JavaPlugin {
    @Getter
    private static ZanderAddonMain instance;
    @Getter
    private PolicyService policyService;
    @Getter
    private BridgeService bridgeService;
    private ExecutorBridgeTask executorBridgeTask;

    @Override
    public void onEnable() {
        instance = this;

        saveDefaultConfig();

        this.policyService = new PolicyService(this);
        this.bridgeService = new BridgeService(this);

        PolicyGUI policyGUI = new PolicyGUI(this);
        SocialGUI socialGUI = new SocialGUI(this);
        getServer().getPluginManager().registerEvents(policyGUI, this);
        getServer().getPluginManager().registerEvents(socialGUI, this);
        getServer().getPluginManager().registerEvents(new PlayerEvents(this, policyGUI, socialGUI), this);

        getCommand("policy").setExecutor(new PolicyCommand(this, policyService));
        getCommand("social").setExecutor(new SocialCommand(this, socialGUI));

        // Vote-reward command bridge: claim + run queued reward commands on join.
        getServer().getPluginManager().registerEvents(new VoteRewardListener(this, bridgeService), this);

        // Executor task queue: poll on a timer and run queued console commands.
        long intervalTicks = Math.max(5L, getConfig().getLong("executor-bridge.poll-interval-seconds", 10L)) * 20L;
        this.executorBridgeTask = new ExecutorBridgeTask(this, bridgeService);
        this.executorBridgeTask.runTaskTimerAsynchronously(this, 20L * 10L, intervalTicks);
        getLogger().info("Command bridge active (executor poll every " + (intervalTicks / 20L) + "s).");

        getLogger().info("Zander Addon has been enabled.");
    }

    @Override
    public void onDisable() {
        if (this.executorBridgeTask != null) {
            this.executorBridgeTask.cancel();
        }
        getLogger().info("Zander Addon has been disabled.");
    }
}
