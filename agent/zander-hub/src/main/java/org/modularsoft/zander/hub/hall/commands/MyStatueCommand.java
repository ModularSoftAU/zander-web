package org.modularsoft.zander.hub.hall.commands;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.jetbrains.annotations.NotNull;

public class MyStatueCommand implements CommandExecutor {
    private final ZanderHubMain plugin;

    public MyStatueCommand(ZanderHubMain plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Players only.");
            return true;
        }

        if (!player.hasPermission("hall.customize")) {
            sender.sendMessage(Component.text("You do not have permission to customize your statue.", NamedTextColor.RED));
            return true;
        }

        plugin.getHallManager().getCustomizationGui().open(player);
        return true;
    }
}
