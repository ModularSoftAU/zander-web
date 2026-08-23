package org.modularsoft.zander.hub.hall.manager;

import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitTask;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.gui.CustomizationGui;
import org.modularsoft.zander.hub.hall.models.HallAssignment;
import org.modularsoft.zander.hub.hall.persistence.HallPersistence;
import org.modularsoft.zander.hub.hall.services.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class HallManager {
    private final ZanderHubMain plugin;
    private final HallConfig hallConfig;
    private final HallPersistence persistence;
    private final SectionManager sectionManager;
    private final SlotManager slotManager;
    private final LuckPermsService luckPermsService;
    private final AssignmentService assignmentService;
    private final RenderService renderService;
    private final CustomizationService customizationService;
    private final CustomizationGui customizationGui;

    private List<HallAssignment> assignments;
    private BukkitTask refreshTask;

    public HallManager(ZanderHubMain plugin) {
        this.plugin = plugin;
        this.hallConfig = new HallConfig(plugin);
        this.persistence = new HallPersistence(plugin);
        this.sectionManager = new SectionManager(persistence);
        this.slotManager = new SlotManager(persistence);
        this.luckPermsService = new LuckPermsService(plugin);
        this.customizationService = new CustomizationService(plugin, this);
        this.customizationGui = new CustomizationGui(plugin);
        this.renderService = new RenderService(plugin, this);
        this.assignmentService = new AssignmentService(plugin, this, luckPermsService);

        this.assignments = persistence.loadAssignments();
    }

    public void init() {
        if (!hallConfig.isEnabled()) return;

        renderService.renderAll();
        startRefreshTask();
    }

    public void stop() {
        if (refreshTask != null) {
            refreshTask.cancel();
        }
    }

    private void startRefreshTask() {
        long interval = hallConfig.getRefreshIntervalMinutes() * 60 * 20L;
        if (interval <= 0) return;

        refreshTask = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            assignmentService.refreshAssignments();
        }, interval, interval);
    }

    public void forceRefresh() {
        assignmentService.refreshAssignments();
    }

    public HallConfig getHallConfig() { return hallConfig; }
    public SectionManager getSectionManager() { return sectionManager; }
    public SlotManager getSlotManager() { return slotManager; }
    public LuckPermsService getLuckPermsService() { return luckPermsService; }
    public AssignmentService getAssignmentService() { return assignmentService; }
    public RenderService getRenderService() { return renderService; }
    public CustomizationService getCustomizationService() { return customizationService; }
    public CustomizationGui getCustomizationGui() { return customizationGui; }

    public List<HallAssignment> getAssignments() { return assignments; }
    public void setAssignments(List<HallAssignment> assignments) { this.assignments = assignments; }

    public HallAssignment getAssignmentForSlot(String slotId) {
        return assignments.stream()
                .filter(a -> a.getSlotId().equals(slotId))
                .findFirst()
                .orElse(null);
    }

    public HallAssignment getAssignmentForPlayer(UUID uuid) {
        return assignments.stream()
                .filter(a -> a.getPlayerUuid().equals(uuid))
                .findFirst()
                .orElse(null);
    }

    public void saveAssignments() {
        persistence.saveAssignments(assignments);
    }
}
