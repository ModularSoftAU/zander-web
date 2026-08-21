package dev.anchorlight.zander.addon.shop;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.settings.dumper.DumperSettings;
import dev.dejvokep.boostedyaml.settings.general.GeneralSettings;
import dev.dejvokep.boostedyaml.settings.loader.LoaderSettings;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ShopDirectoryConfigTest {

    private YamlDocument yamlFrom(String yaml) throws IOException {
        byte[] bytes = yaml.getBytes(StandardCharsets.UTF_8);
        return YamlDocument.create(new ByteArrayInputStream(bytes), new ByteArrayInputStream(bytes),
                GeneralSettings.DEFAULT, LoaderSettings.DEFAULT, DumperSettings.DEFAULT,
                dev.dejvokep.boostedyaml.settings.updater.UpdaterSettings.DEFAULT);
    }

    @Test
    void defaultsToDisabledWhenSectionMissing() throws IOException {
        YamlDocument config = yamlFrom("");
        ShopDirectoryConfig result = ShopDirectoryConfig.from(config);
        assertFalse(result.enabled());
    }

    @Test
    void parsesFullSection() throws IOException {
        YamlDocument config = yamlFrom("""
                shop-directory:
                  enabled: true
                  selling-only: false
                  in-stock-only: false
                  results-per-page: 5
                  worlds: ["world", "world_nether"]
                  navigation:
                    enabled: false
                    arrival-distance: 3
                    update-interval-ticks: 20
                    compass: false
                    action-bar: false
                """);
        ShopDirectoryConfig result = ShopDirectoryConfig.from(config);

        assertTrue(result.enabled());
        assertFalse(result.sellingOnly());
        assertFalse(result.inStockOnly());
        assertEquals(5, result.resultsPerPage());
        assertEquals(List.of("world", "world_nether"), result.worlds());
        assertFalse(result.navigationEnabled());
        assertEquals(3, result.arrivalDistance());
        assertEquals(20L, result.updateIntervalTicks());
        assertFalse(result.compass());
        assertFalse(result.actionBar());
    }

    @Test
    void missingWorldsDefaultsToEmptyList() throws IOException {
        YamlDocument config = yamlFrom("shop-directory:\n  enabled: true\n");
        ShopDirectoryConfig result = ShopDirectoryConfig.from(config);
        assertTrue(result.worlds().isEmpty());
    }
}
