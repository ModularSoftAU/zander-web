package org.modularsoft.zander.hub.hall.models;

import org.bukkit.Material;
import org.bukkit.util.EulerAngle;
import java.util.UUID;

public class HallCustomization {
    private UUID playerUuid;
    private Material chestplate;
    private Material leggings;
    private Material boots;
    private Material mainHand;
    private Material offHand;
    private String posePreset;
    private String particleEffect;
    private EulerAngle bodyPose;
    private EulerAngle headPose;
    private EulerAngle leftArmPose;
    private EulerAngle rightArmPose;
    private EulerAngle leftLegPose;
    private EulerAngle rightLegPose;
    private long updatedAt;

    public HallCustomization(UUID playerUuid) {
        this.playerUuid = playerUuid;
        this.updatedAt = System.currentTimeMillis();
    }

    // Getters and Setters
    public UUID getPlayerUuid() { return playerUuid; }
    public Material getChestplate() { return chestplate; }
    public void setChestplate(Material chestplate) { this.chestplate = chestplate; }
    public Material getLeggings() { return leggings; }
    public void setLeggings(Material leggings) { this.leggings = leggings; }
    public Material getBoots() { return boots; }
    public void setBoots(Material boots) { this.boots = boots; }
    public Material getMainHand() { return mainHand; }
    public void setMainHand(Material mainHand) { this.mainHand = mainHand; }
    public Material getOffHand() { return offHand; }
    public void setOffHand(Material offHand) { this.offHand = offHand; }
    public String getPosePreset() { return posePreset; }
    public void setPosePreset(String posePreset) { this.posePreset = posePreset; }
    public String getParticleEffect() { return particleEffect; }
    public void setParticleEffect(String particleEffect) { this.particleEffect = particleEffect; }
    public EulerAngle getBodyPose() { return bodyPose; }
    public void setBodyPose(EulerAngle bodyPose) { this.bodyPose = bodyPose; }
    public EulerAngle getHeadPose() { return headPose; }
    public void setHeadPose(EulerAngle headPose) { this.headPose = headPose; }
    public EulerAngle getLeftArmPose() { return leftArmPose; }
    public void setLeftArmPose(EulerAngle leftArmPose) { this.leftArmPose = leftArmPose; }
    public EulerAngle getRightArmPose() { return rightArmPose; }
    public void setRightArmPose(EulerAngle rightArmPose) { this.rightArmPose = rightArmPose; }
    public EulerAngle getLeftLegPose() { return leftLegPose; }
    public void setLeftLegPose(EulerAngle leftLegPose) { this.leftLegPose = leftLegPose; }
    public EulerAngle getRightLegPose() { return rightLegPose; }
    public void setRightLegPose(EulerAngle rightLegPose) { this.rightLegPose = rightLegPose; }
    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
}
