package dev.anchorlight.zander.addon.shop;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ShopDirectoryConfigTest {

    @Test
    void defaultsToDisabledWhenSectionMissing() {
        YamlConfiguration yaml = new YamlConfiguration();
        ShopDirectoryConfig config = ShopDirectoryConfig.from(yaml);
        assertFalse(config.enabled());
    }

    @Test
    void parsesFullSection() {
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("shop-directory.enabled", true);
        yaml.set("shop-directory.selling-only", false);
        yaml.set("shop-directory.in-stock-only", false);
        yaml.set("shop-directory.results-per-page", 5);
        yaml.set("shop-directory.worlds", java.util.List.of("world", "world_nether"));
        yaml.set("shop-directory.navigation.enabled", false);
        yaml.set("shop-directory.navigation.arrival-distance", 3);
        yaml.set("shop-directory.navigation.update-interval-ticks", 20);
        yaml.set("shop-directory.navigation.compass", false);
        yaml.set("shop-directory.navigation.action-bar", false);

        ShopDirectoryConfig config = ShopDirectoryConfig.from(yaml);

        assertTrue(config.enabled());
        assertFalse(config.sellingOnly());
        assertFalse(config.inStockOnly());
        assertEquals(5, config.resultsPerPage());
        assertEquals(java.util.List.of("world", "world_nether"), config.worlds());
        assertFalse(config.navigationEnabled());
        assertEquals(3, config.arrivalDistance());
        assertEquals(20L, config.updateIntervalTicks());
        assertFalse(config.compass());
        assertFalse(config.actionBar());
    }

    @Test
    void missingWorldsDefaultsToEmptyList() {
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("shop-directory.enabled", true);
        ShopDirectoryConfig config = ShopDirectoryConfig.from(yaml);
        assertTrue(config.worlds().isEmpty());
    }
}
