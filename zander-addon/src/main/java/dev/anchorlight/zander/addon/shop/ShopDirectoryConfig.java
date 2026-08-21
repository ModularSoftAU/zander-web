package dev.anchorlight.zander.addon.shop;

import org.bukkit.configuration.file.FileConfiguration;

import java.util.List;

public record ShopDirectoryConfig(
        boolean enabled,
        boolean sellingOnly,
        boolean inStockOnly,
        int resultsPerPage,
        List<String> worlds,
        boolean navigationEnabled,
        int arrivalDistance,
        long updateIntervalTicks,
        boolean compass,
        boolean actionBar
) {
    public static ShopDirectoryConfig from(FileConfiguration config) {
        String base = "shop-directory";
        return new ShopDirectoryConfig(
                config.getBoolean(base + ".enabled", false),
                config.getBoolean(base + ".selling-only", true),
                config.getBoolean(base + ".in-stock-only", true),
                config.getInt(base + ".results-per-page", 8),
                config.getStringList(base + ".worlds"),
                config.getBoolean(base + ".navigation.enabled", true),
                config.getInt(base + ".navigation.arrival-distance", 5),
                config.getLong(base + ".navigation.update-interval-ticks", 10L),
                config.getBoolean(base + ".navigation.compass", true),
                config.getBoolean(base + ".navigation.action-bar", true)
        );
    }
}
