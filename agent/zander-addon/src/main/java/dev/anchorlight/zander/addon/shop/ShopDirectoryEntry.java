package dev.anchorlight.zander.addon.shop;

import org.bukkit.Location;
import org.bukkit.Material;

import java.util.UUID;

public record ShopDirectoryEntry(
        String shopId,
        Material item,
        String itemDisplayName,
        UUID ownerUuid,
        String ownerDisplayName,
        double price,
        ShopKind kind,
        int stock,
        String world,
        Location location
) {
    public enum ShopKind {
        SELLING,
        BUYING
    }
}
