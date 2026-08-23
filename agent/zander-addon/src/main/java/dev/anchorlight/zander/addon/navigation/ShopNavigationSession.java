package dev.anchorlight.zander.addon.navigation;

import dev.anchorlight.zander.addon.shop.ShopDirectoryEntry;
import org.bukkit.Location;

import java.util.UUID;

public class ShopNavigationSession {

    private final UUID playerId;
    private final String shopId;
    private final String itemDisplayName;
    private final String ownerDisplayName;
    private final Location location;

    private boolean previousCompassWasCustom;
    private Location previousCompassTarget;

    public ShopNavigationSession(UUID playerId, ShopDirectoryEntry target) {
        this.playerId = playerId;
        this.shopId = target.shopId();
        this.itemDisplayName = target.itemDisplayName();
        this.ownerDisplayName = target.ownerDisplayName();
        this.location = target.location();
    }

    public double distanceTo(Location playerLocation) {
        if (!playerLocation.getWorld().getName().equals(location.getWorld().getName())) {
            throw new IllegalArgumentException("Cannot compute distance across different worlds");
        }
        return playerLocation.distance(location);
    }

    public boolean hasArrived(Location playerLocation, int arrivalDistance) {
        return distanceTo(playerLocation) <= arrivalDistance;
    }

    public UUID playerId() {
        return playerId;
    }

    public String shopId() {
        return shopId;
    }

    public String itemDisplayName() {
        return itemDisplayName;
    }

    public String ownerDisplayName() {
        return ownerDisplayName;
    }

    public Location location() {
        return location;
    }

    public void capturePreviousCompass(boolean wasCustom, Location previousTarget) {
        this.previousCompassWasCustom = wasCustom;
        this.previousCompassTarget = previousTarget;
    }

    public boolean previousCompassWasCustom() {
        return previousCompassWasCustom;
    }

    public Location previousCompassTarget() {
        return previousCompassTarget;
    }
}
