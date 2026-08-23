package dev.anchorlight.zander.addon.events;

import dev.anchorlight.zander.addon.navigation.ShopNavigationService;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;

public class ShopDirectoryPlayerListener implements Listener {
    private final ShopNavigationService navigationService;

    public ShopDirectoryPlayerListener(ShopNavigationService navigationService) {
        this.navigationService = navigationService;
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        navigationService.cleanupOnQuit(event.getPlayer().getUniqueId());
    }
}
