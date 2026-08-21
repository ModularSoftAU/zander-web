package dev.anchorlight.zander.addon.shop;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;

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
    public static ShopDirectoryConfig from(YamlDocument config) {
        return new ShopDirectoryConfig(
                config.getBoolean(Route.from("shop-directory", "enabled"), false),
                config.getBoolean(Route.from("shop-directory", "selling-only"), true),
                config.getBoolean(Route.from("shop-directory", "in-stock-only"), true),
                config.getInt(Route.from("shop-directory", "results-per-page"), 8),
                config.getStringList(Route.from("shop-directory", "worlds")),
                config.getBoolean(Route.from("shop-directory", "navigation", "enabled"), true),
                config.getInt(Route.from("shop-directory", "navigation", "arrival-distance"), 5),
                config.getLong(Route.from("shop-directory", "navigation", "update-interval-ticks"), 10L),
                config.getBoolean(Route.from("shop-directory", "navigation", "compass"), true),
                config.getBoolean(Route.from("shop-directory", "navigation", "action-bar"), true)
        );
    }
}
