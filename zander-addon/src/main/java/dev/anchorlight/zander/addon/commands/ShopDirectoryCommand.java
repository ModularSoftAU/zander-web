package dev.anchorlight.zander.addon.commands;

import dev.anchorlight.zander.addon.dialog.ShopDirectoryDialog;
import dev.anchorlight.zander.addon.navigation.ShopNavigationService;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

public class ShopDirectoryCommand implements CommandExecutor {

    private final ShopDirectoryDialog directoryDialog;
    private final ShopNavigationService navigationService;

    public ShopDirectoryCommand(ShopDirectoryDialog directoryDialog, ShopNavigationService navigationService) {
        this.directoryDialog = directoryDialog;
        this.navigationService = navigationService;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!sender.hasPermission("zander.shops")) {
            sender.sendMessage(Component.text("You do not have permission to use this command.", NamedTextColor.RED));
            return true;
        }

        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("This command can only be used by players.", NamedTextColor.RED));
            return true;
        }

        if (args.length == 1 && args[0].equalsIgnoreCase("cancel")) {
            navigationService.cancel(player.getUniqueId());
            return true;
        }

        directoryDialog.open(player);
        return true;
    }
}
