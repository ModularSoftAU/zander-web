package org.modularsoft.zander.hub.hall.services;

import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import org.bukkit.Particle;
import org.bukkit.block.Block;
import org.bukkit.block.Sign;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;
import org.bukkit.util.EulerAngle;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;
import org.modularsoft.zander.hub.hall.models.HallAssignment;
import org.modularsoft.zander.hub.hall.models.HallCustomization;
import org.modularsoft.zander.hub.hall.models.HallSection;
import org.modularsoft.zander.hub.hall.models.HallSlot;

import java.util.Collection;
import java.util.UUID;

public class RenderService {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;

    public RenderService(ZanderHubMain plugin, HallManager hallManager) {
        this.plugin = plugin;
        this.hallManager = hallManager;
        startParticleTask();
    }

    public void renderAll() {
        for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
            renderSlot(slot);
        }
    }

    public void renderSlot(HallSlot slot) {
        if (!slot.getLocation().isChunkLoaded()) return;

        HallAssignment assignment = hallManager.getAssignmentForSlot(slot.getId());
        if (assignment == null) {
            clearSlot(slot);
            return;
        }

        updateArmorStand(slot, assignment);
        updateSign(slot, assignment);
    }

    private void clearSlot(HallSlot slot) {
        removeArmorStandAt(slot.getLocation());
        clearSign(slot.getSignLocation());
    }

    private void updateArmorStand(HallSlot slot, HallAssignment assignment) {
        Location loc = slot.getLocation();
        ArmorStand as = getArmorStandAt(loc);
        if (as == null) {
            as = (ArmorStand) loc.getWorld().spawnEntity(loc, EntityType.ARMOR_STAND);
        }

        OfflinePlayer player = Bukkit.getOfflinePlayer(assignment.getPlayerUuid());
        HallCustomization custom = hallManager.getCustomizationService().getCustomization(assignment.getPlayerUuid());

        as.setBasePlate(false);
        as.setArms(true);
        as.setGravity(false);
        as.setCustomNameVisible(true);
        as.customName(Component.text(player.getName() != null ? player.getName() : "Unknown"));

        // Forced Head
        ItemStack head = new ItemStack(Material.PLAYER_HEAD);
        SkullMeta meta = (SkullMeta) head.getItemMeta();
        meta.setOwningPlayer(player);
        head.setItemMeta(meta);
        as.getEquipment().setHelmet(head);

        // Customization
        if (custom != null) {
            as.getEquipment().setChestplate(new ItemStack(custom.getChestplate() != null ? custom.getChestplate() : Material.AIR));
            as.getEquipment().setLeggings(new ItemStack(custom.getLeggings() != null ? custom.getLeggings() : Material.AIR));
            as.getEquipment().setBoots(new ItemStack(custom.getBoots() != null ? custom.getBoots() : Material.AIR));
            as.getEquipment().setItemInMainHand(new ItemStack(custom.getMainHand() != null ? custom.getMainHand() : Material.AIR));
            as.getEquipment().setItemInOffHand(new ItemStack(custom.getOffHand() != null ? custom.getOffHand() : Material.AIR));

            if (custom.getPosePreset() != null) {
                applyPosePreset(as, custom.getPosePreset());
            } else {
                if (custom.getBodyPose() != null) as.setBodyPose(custom.getBodyPose());
                if (custom.getHeadPose() != null) as.setHeadPose(custom.getHeadPose());
                if (custom.getLeftArmPose() != null) as.setLeftArmPose(custom.getLeftArmPose());
                if (custom.getRightArmPose() != null) as.setRightArmPose(custom.getRightArmPose());
                if (custom.getLeftLegPose() != null) as.setLeftLegPose(custom.getLeftLegPose());
                if (custom.getRightLegPose() != null) as.setRightLegPose(custom.getRightLegPose());
            }
        } else {
            as.getEquipment().setChestplate(null);
            as.getEquipment().setLeggings(null);
            as.getEquipment().setBoots(null);
            as.getEquipment().setItemInMainHand(null);
            as.getEquipment().setItemInOffHand(null);
        }
    }

    private void updateSign(HallSlot slot, HallAssignment assignment) {
        Location loc = slot.getSignLocation();
        if (loc == null) return;
        Block block = loc.getBlock();
        if (!(block.getState() instanceof Sign)) return;

        Sign sign = (Sign) block.getState();
        OfflinePlayer player = Bukkit.getOfflinePlayer(assignment.getPlayerUuid());
        HallSection section = hallManager.getSectionManager().getSections().get(assignment.getSectionId());

        sign.line(0, Component.text(player.getName() != null ? player.getName() : ""));
        sign.line(1, Component.text(section != null ? section.getSignLabel() : ""));
        sign.line(2, Component.empty());
        sign.line(3, Component.empty());
        sign.update();
    }

    private void clearSign(Location loc) {
        if (loc == null) return;
        Block block = loc.getBlock();
        if (!(block.getState() instanceof Sign)) return;

        Sign sign = (Sign) block.getState();
        for (int i = 0; i < 4; i++) sign.line(i, Component.empty());
        sign.update();
    }

    private ArmorStand getArmorStandAt(Location loc) {
        Collection<Entity> entities = loc.getWorld().getNearbyEntities(loc, 0.5, 0.5, 0.5);
        for (Entity e : entities) {
            if (e instanceof ArmorStand) return (ArmorStand) e;
        }
        return null;
    }

    private void removeArmorStandAt(Location loc) {
        ArmorStand as = getArmorStandAt(loc);
        if (as != null) as.remove();
    }

    private void applyPosePreset(ArmorStand as, String preset) {
        switch (preset.toUpperCase()) {
            case "ZOMBIE":
                as.setLeftArmPose(new EulerAngle(Math.toRadians(-90), 0, 0));
                as.setRightArmPose(new EulerAngle(Math.toRadians(-90), 0, 0));
                break;
            case "RUNNING":
                as.setLeftArmPose(new EulerAngle(Math.toRadians(-40), 0, 0));
                as.setRightArmPose(new EulerAngle(Math.toRadians(40), 0, 0));
                as.setLeftLegPose(new EulerAngle(Math.toRadians(40), 0, 0));
                as.setRightLegPose(new EulerAngle(Math.toRadians(-40), 0, 0));
                break;
            case "DANCING":
                as.setLeftArmPose(new EulerAngle(Math.toRadians(-120), Math.toRadians(40), 0));
                as.setRightArmPose(new EulerAngle(Math.toRadians(-120), Math.toRadians(-40), 0));
                break;
            default: // DEFAULT
                as.setBodyPose(EulerAngle.ZERO);
                as.setLeftArmPose(new EulerAngle(Math.toRadians(-10), 0, Math.toRadians(-10)));
                as.setRightArmPose(new EulerAngle(Math.toRadians(-10), 0, Math.toRadians(10)));
                as.setLeftLegPose(new EulerAngle(Math.toRadians(1), 0, Math.toRadians(1)));
                as.setRightLegPose(new EulerAngle(Math.toRadians(1), 0, Math.toRadians(-1)));
                break;
        }
    }

    private void startParticleTask() {
        Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
                if (!slot.getLocation().isChunkLoaded()) continue;
                HallAssignment assignment = hallManager.getAssignmentForSlot(slot.getId());
                if (assignment == null) continue;

                HallCustomization custom = hallManager.getCustomizationService().getCustomization(assignment.getPlayerUuid());
                if (custom == null || custom.getParticleEffect() == null) continue;

                try {
                    Particle particle = Particle.valueOf(custom.getParticleEffect());
                    slot.getLocation().getWorld().spawnParticle(particle, slot.getLocation().clone().add(0, 1, 0), 3, 0.3, 0.5, 0.3, 0.02);
                } catch (Exception ignored) {}
            }
        }, 20L, 10L);
    }
}
