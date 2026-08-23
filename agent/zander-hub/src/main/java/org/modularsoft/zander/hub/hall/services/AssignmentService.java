package org.modularsoft.zander.hub.hall.services;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;
import org.modularsoft.zander.hub.hall.models.HallAssignment;
import org.modularsoft.zander.hub.hall.models.HallSection;
import org.modularsoft.zander.hub.hall.models.HallSlot;

import java.util.*;
import java.util.stream.Collectors;

public class AssignmentService {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;
    private final LuckPermsService luckPermsService;

    public AssignmentService(ZanderHubMain plugin, HallManager hallManager, LuckPermsService luckPermsService) {
        this.plugin = plugin;
        this.hallManager = hallManager;
        this.luckPermsService = luckPermsService;
    }

    public void refreshAssignments() {
        // Run refresh logic asynchronously to avoid blocking main thread
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            Set<UUID> pool = new HashSet<>();
            Bukkit.getOnlinePlayers().forEach(p -> pool.add(p.getUniqueId()));
            hallManager.getAssignments().forEach(a -> pool.add(a.getPlayerUuid()));

            // Fetch global UUIDs from all configured sections
            List<String> allGroups = hallManager.getSectionManager().getSections().values().stream()
                    .flatMap(s -> s.getGroups().stream())
                    .distinct()
                    .collect(Collectors.toList());

            luckPermsService.getUuidsInGroups(allGroups).thenCompose(globalUuids -> {
                pool.addAll(globalUuids);
                // Preload users in LuckPerms asynchronously
                return luckPermsService.preloadUsers(pool);
            }).thenRun(() -> {
                // Now run the assignment logic (back on main thread for safety with collections and rendering)
                Bukkit.getScheduler().runTask(plugin, () -> {
                    performAssignment(pool);
                });
            });
        });
    }

    private void performAssignment(Set<UUID> pool) {
        List<HallSection> sections = new ArrayList<>(hallManager.getSectionManager().getSections().values());
        sections.sort(Comparator.comparingInt(HallSection::getPriority).reversed());

        Map<String, List<HallSlot>> slotsBySection = hallManager.getSlotManager().getSlots().values().stream()
                .collect(Collectors.groupingBy(HallSlot::getSectionId));

        List<HallAssignment> newAssignments = new ArrayList<>();
        Set<UUID> assignedPlayers = new HashSet<>();

        // Handle locked slots and manual assignments first
        for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
            if (slot.isLocked()) {
                HallAssignment current = hallManager.getAssignmentForSlot(slot.getId());
                if (current != null) {
                    newAssignments.add(current);
                    assignedPlayers.add(current.getPlayerUuid());
                }
            }
        }

        for (HallAssignment manual : hallManager.getAssignments()) {
            if (manual.getType() == HallAssignment.AssignmentType.MANUAL) {
                if (newAssignments.stream().noneMatch(a -> a.getSlotId().equals(manual.getSlotId()))) {
                    newAssignments.add(manual);
                    assignedPlayers.add(manual.getPlayerUuid());
                }
            }
        }

        for (HallSection section : sections) {
            if (!section.isEnabled()) continue;

            List<HallSlot> availableSlots = slotsBySection.getOrDefault(section.getId(), new ArrayList<>()).stream()
                    .filter(slot -> !slot.isLocked() && !isSlotManuallyAssigned(slot.getId(), newAssignments))
                    .sorted(Comparator.comparingInt(HallSlot::getDisplayOrder))
                    .collect(Collectors.toList());

            if (availableSlots.isEmpty()) continue;

            // Get eligible players for this section from the preloaded pool
            List<UUID> eligible = pool.stream()
                    .filter(uuid -> luckPermsService.isInAnyGroup(uuid, section.getGroups()))
                    .collect(Collectors.toList());

            // Filter out already assigned players
            eligible.removeIf(assignedPlayers::contains);

            // Sort eligible players
            sortEligible(eligible, section.getSortMode());

            // Fill slots
            for (int i = 0; i < Math.min(availableSlots.size(), eligible.size()); i++) {
                HallSlot slot = availableSlots.get(i);
                UUID playerUuid = eligible.get(i);

                newAssignments.add(new HallAssignment(
                        slot.getId(),
                        playerUuid,
                        section.getId(),
                        HallAssignment.AssignmentType.AUTO,
                        System.currentTimeMillis()
                ));
                assignedPlayers.add(playerUuid);
            }
        }

        hallManager.setAssignments(newAssignments);
        hallManager.saveAssignments();
        hallManager.getRenderService().renderAll();
    }

    private boolean isSlotManuallyAssigned(String slotId, List<HallAssignment> assignments) {
        return assignments.stream().anyMatch(a -> a.getSlotId().equals(slotId));
    }

    private void sortEligible(List<UUID> players, String mode) {
        switch (mode.toLowerCase()) {
            case "weight_desc":
                players.sort(Comparator.comparingInt(luckPermsService::getWeight).reversed());
                break;
            case "username_asc":
                players.sort(Comparator.comparing(uuid -> {
                    OfflinePlayer op = Bukkit.getOfflinePlayer(uuid);
                    return op.getName() != null ? op.getName() : "";
                }));
                break;
            case "username_desc":
                players.sort(Collections.reverseOrder(Comparator.comparing(uuid -> {
                    OfflinePlayer op = Bukkit.getOfflinePlayer(uuid);
                    return op.getName() != null ? op.getName() : "";
                })));
                break;
        }
    }
}
