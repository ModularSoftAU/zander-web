package org.modularsoft.zander.addon.events;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.modularsoft.zander.addon.service.StoreCommandService;

public class StoreCommandEvents implements Listener {

    private final StoreCommandService storeCommandService;

    public StoreCommandEvents(StoreCommandService storeCommandService) {
        this.storeCommandService = storeCommandService;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();
        String name = event.getPlayer().getName();
        storeCommandService.onPlayerJoin(uuid, name);
    }
}
