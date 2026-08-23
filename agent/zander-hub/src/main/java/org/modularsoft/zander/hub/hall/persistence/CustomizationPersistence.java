package org.modularsoft.zander.hub.hall.persistence;

import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.util.EulerAngle;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.models.HallCustomization;

import java.io.File;
import java.io.IOException;
import java.util.UUID;

public class CustomizationPersistence {
    private final ZanderHubMain plugin;
    private final File folder;

    public CustomizationPersistence(ZanderHubMain plugin) {
        this.plugin = plugin;
        this.folder = new File(plugin.getDataFolder(), "hall/customizations");
        if (!folder.exists()) folder.mkdirs();
    }

    public HallCustomization load(UUID playerUuid) {
        File file = new File(folder, playerUuid.toString() + ".yml");
        if (!file.exists()) return null;

        FileConfiguration config = YamlConfiguration.loadConfiguration(file);
        HallCustomization c = new HallCustomization(playerUuid);
        c.setChestplate(getMaterial(config.getString("chestplate")));
        c.setLeggings(getMaterial(config.getString("leggings")));
        c.setBoots(getMaterial(config.getString("boots")));
        c.setMainHand(getMaterial(config.getString("main-hand")));
        c.setOffHand(getMaterial(config.getString("off-hand")));
        c.setPosePreset(config.getString("pose-preset"));
        c.setParticleEffect(config.getString("particle-effect"));
        c.setBodyPose(getEulerAngle(config, "body-pose"));
        c.setHeadPose(getEulerAngle(config, "head-pose"));
        c.setLeftArmPose(getEulerAngle(config, "left-arm-pose"));
        c.setRightArmPose(getEulerAngle(config, "right-arm-pose"));
        c.setLeftLegPose(getEulerAngle(config, "left-leg-pose"));
        c.setRightLegPose(getEulerAngle(config, "right-leg-pose"));
        c.setUpdatedAt(config.getLong("updated-at"));
        return c;
    }

    public void save(HallCustomization c) {
        File file = new File(folder, c.getPlayerUuid().toString() + ".yml");
        FileConfiguration config = new YamlConfiguration();
        config.set("chestplate", c.getChestplate() != null ? c.getChestplate().name() : null);
        config.set("leggings", c.getLeggings() != null ? c.getLeggings().name() : null);
        config.set("boots", c.getBoots() != null ? c.getBoots().name() : null);
        config.set("main-hand", c.getMainHand() != null ? c.getMainHand().name() : null);
        config.set("off-hand", c.getOffHand() != null ? c.getOffHand().name() : null);
        config.set("pose-preset", c.getPosePreset());
        config.set("particle-effect", c.getParticleEffect());
        setEulerAngle(config, "body-pose", c.getBodyPose());
        setEulerAngle(config, "head-pose", c.getHeadPose());
        setEulerAngle(config, "left-arm-pose", c.getLeftArmPose());
        setEulerAngle(config, "right-arm-pose", c.getRightArmPose());
        setEulerAngle(config, "left-leg-pose", c.getLeftLegPose());
        setEulerAngle(config, "right-leg-pose", c.getRightLegPose());
        config.set("updated-at", c.getUpdatedAt());

        try {
            config.save(file);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private Material getMaterial(String name) {
        if (name == null) return null;
        try {
            return Material.valueOf(name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private EulerAngle getEulerAngle(FileConfiguration config, String path) {
        if (!config.contains(path)) return null;
        double x = config.getDouble(path + ".x");
        double y = config.getDouble(path + ".y");
        double z = config.getDouble(path + ".z");
        return new EulerAngle(x, y, z);
    }

    private void setEulerAngle(FileConfiguration config, String path, EulerAngle angle) {
        if (angle == null) return;
        config.set(path + ".x", angle.getX());
        config.set(path + ".y", angle.getY());
        config.set(path + ".z", angle.getZ());
    }
}
