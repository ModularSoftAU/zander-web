package org.modularsoft.zander.hub.hall.events;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.world.ChunkLoadEvent;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;

public class HallListeners implements Listener {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;

    public HallListeners(ZanderHubMain plugin) {
        this.plugin = plugin;
        this.hallManager = plugin.getHallManager();
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        // Potential refresh on join if they are eligible for a section
        hallManager.getAssignmentService().refreshAssignments();
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        // Refresh on quit to potentially fill the slot with someone else if they are no longer "available"
        // depending on how we define "eligible" pool.
        hallManager.getAssignmentService().refreshAssignments();
    }

    @EventHandler
    public void onChunkLoad(ChunkLoadEvent event) {
        // Re-render statues in the loaded chunk
        hallManager.getSlotManager().getSlots().values().stream()
                .filter(slot -> slot.getLocation().getChunk().equals(event.getChunk()))
                .forEach(slot -> hallManager.getRenderService().renderSlot(slot));
    }
}
