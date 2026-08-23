package org.modularsoft.zander.hub.hall.persistence;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.models.HallAssignment;
import org.modularsoft.zander.hub.hall.models.HallSection;
import org.modularsoft.zander.hub.hall.models.HallSlot;

import java.io.File;
import java.io.IOException;
import java.util.*;

public class HallPersistence {
    private final ZanderHubMain plugin;
    private final File sectionsFile;
    private final File slotsFile;
    private final File assignmentsFile;

    public HallPersistence(ZanderHubMain plugin) {
        this.plugin = plugin;
        File hallFolder = new File(plugin.getDataFolder(), "hall");
        if (!hallFolder.exists()) hallFolder.mkdirs();

        this.sectionsFile = new File(hallFolder, "sections.yml");
        this.slotsFile = new File(hallFolder, "slots.yml");
        this.assignmentsFile = new File(hallFolder, "assignments.yml");
    }

    public Map<String, HallSection> loadSections() {
        Map<String, HallSection> sections = new HashMap<>();
        if (!sectionsFile.exists()) return sections;

        FileConfiguration config = YamlConfiguration.loadConfiguration(sectionsFile);
        for (String id : config.getKeys(false)) {
            ConfigurationSection sec = config.getConfigurationSection(id);
            if (sec == null) continue;

            HallSection section = new HallSection(
                    id,
                    sec.getString("display-name"),
                    sec.getString("sign-label"),
                    sec.getStringList("groups"),
                    sec.getInt("priority"),
                    sec.getString("sort-mode", "weight_desc"),
                    sec.getBoolean("allow-customization", true),
                    sec.getBoolean("enabled", true)
            );
            sections.put(id, section);
        }
        return sections;
    }

    public void saveSections(Map<String, HallSection> sections) {
        FileConfiguration config = new YamlConfiguration();
        for (HallSection sec : sections.values()) {
            ConfigurationSection s = config.createSection(sec.getId());
            s.set("display-name", sec.getDisplayName());
            s.set("sign-label", sec.getSignLabel());
            s.set("groups", sec.getGroups());
            s.set("priority", sec.getPriority());
            s.set("sort-mode", sec.getSortMode());
            s.set("allow-customization", sec.isAllowCustomization());
            s.set("enabled", sec.isEnabled());
        }
        try {
            config.save(sectionsFile);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public Map<String, HallSlot> loadSlots() {
        Map<String, HallSlot> slots = new HashMap<>();
        if (!slotsFile.exists()) return slots;

        FileConfiguration config = YamlConfiguration.loadConfiguration(slotsFile);
        for (String id : config.getKeys(false)) {
            ConfigurationSection sec = config.getConfigurationSection(id);
            if (sec == null) continue;

            HallSlot slot = new HallSlot(
                    id,
                    sec.getString("section-id"),
                    sec.getLocation("location"),
                    sec.getLocation("sign-location"),
                    sec.getBoolean("locked"),
                    sec.getInt("display-order")
            );
            slots.put(id, slot);
        }
        return slots;
    }

    public void saveSlots(Map<String, HallSlot> slots) {
        FileConfiguration config = new YamlConfiguration();
        for (HallSlot slot : slots.values()) {
            ConfigurationSection s = config.createSection(slot.getId());
            s.set("section-id", slot.getSectionId());
            s.set("location", slot.getLocation());
            s.set("sign-location", slot.getSignLocation());
            s.set("locked", slot.isLocked());
            s.set("display-order", slot.getDisplayOrder());
        }
        try {
            config.save(slotsFile);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public List<HallAssignment> loadAssignments() {
        List<HallAssignment> assignments = new ArrayList<>();
        if (!assignmentsFile.exists()) return assignments;

        FileConfiguration config = YamlConfiguration.loadConfiguration(assignmentsFile);
        ConfigurationSection sec = config.getConfigurationSection("assignments");
        if (sec == null) return assignments;

        for (String slotId : sec.getKeys(false)) {
            ConfigurationSection a = sec.getConfigurationSection(slotId);
            HallAssignment assignment = new HallAssignment(
                    slotId,
                    UUID.fromString(a.getString("player-uuid")),
                    a.getString("section-id"),
                    HallAssignment.AssignmentType.valueOf(a.getString("type")),
                    a.getLong("updated-at")
            );
            assignments.add(assignment);
        }
        return assignments;
    }

    public void saveAssignments(List<HallAssignment> assignments) {
        FileConfiguration config = new YamlConfiguration();
        ConfigurationSection sec = config.createSection("assignments");
        for (HallAssignment a : assignments) {
            ConfigurationSection s = sec.createSection(a.getSlotId());
            s.set("player-uuid", a.getPlayerUuid().toString());
            s.set("section-id", a.getSectionId());
            s.set("type", a.getType().name());
            s.set("updated-at", a.getUpdatedAt());
        }
        try {
            config.save(assignmentsFile);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
