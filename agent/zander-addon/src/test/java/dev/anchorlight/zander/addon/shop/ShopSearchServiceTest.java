package dev.anchorlight.zander.addon.shop;

import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ShopSearchServiceTest {

    private final Map<String, World> mockWorlds = new HashMap<>();

    private World getMockWorld(String worldName) {
        return mockWorlds.computeIfAbsent(worldName, name -> {
            World mockWorld = Mockito.mock(World.class);
            Mockito.when(mockWorld.getName()).thenReturn(name);
            return mockWorld;
        });
    }

    private ShopDirectoryEntry entry(String shopId, String item, double price, int stock,
                                      ShopDirectoryEntry.ShopKind kind, String world, double x) {
        World mockWorld = getMockWorld(world);
        Location loc = new Location(mockWorld, x, 64, 0);
        return new ShopDirectoryEntry(shopId, Material.matchMaterial(item.toUpperCase().replace(' ', '_')) != null
                ? Material.matchMaterial(item.toUpperCase().replace(' ', '_')) : Material.DIAMOND,
                item, UUID.randomUUID(), "Ben", price, kind, stock, world, loc);
    }

    private ShopDirectoryConfig defaultConfig() {
        return new ShopDirectoryConfig(true, true, true, 8, List.of("world"), true, 5, 10L, true, true, true);
    }

    @Test
    void normalizeHandlesUnderscoresCasingAndSpaces() {
        assertEquals("golden carrot", ShopSearchService.normalize("GOLDEN_CARROT"));
        assertEquals("golden carrot", ShopSearchService.normalize("Golden Carrot"));
        assertEquals("golden carrot", ShopSearchService.normalize("golden carrot"));
    }

    @Test
    void exactAndCaseInsensitiveMatch() {
        ShopDirectoryEntry diamond = entry("1", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 0);
        assertTrue(ShopSearchService.matches("diamond", diamond));
        assertTrue(ShopSearchService.matches("DIAMOND".toLowerCase(), diamond));
    }

    @Test
    void unknownItemReturnsNoResults() {
        List<ShopDirectoryEntry> index = List.of(entry("1", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 0));
        World mockWorld = getMockWorld("world");
        Location playerLoc = new Location(mockWorld, 0, 64, 0);
        List<ShopDirectoryEntry> results = ShopSearchService.search(index, "nonexistent_item_xyz", defaultConfig(), playerLoc, "world");
        assertTrue(results.isEmpty());
    }

    @Test
    void sellingOnlyExcludesBuyingShops() {
        List<ShopDirectoryEntry> index = List.of(
                entry("1", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 0),
                entry("2", "Diamond", 12, 5, ShopDirectoryEntry.ShopKind.BUYING, "world", 0)
        );
        World mockWorld = getMockWorld("world");
        Location playerLoc = new Location(mockWorld, 0, 64, 0);
        List<ShopDirectoryEntry> results = ShopSearchService.search(index, "diamond", defaultConfig(), playerLoc, "world");
        assertEquals(1, results.size());
        assertEquals("1", results.get(0).shopId());
    }

    @Test
    void inStockOnlyExcludesEmptyShops() {
        List<ShopDirectoryEntry> index = List.of(
                entry("1", "Diamond", 10, 0, ShopDirectoryEntry.ShopKind.SELLING, "world", 0),
                entry("2", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 0)
        );
        World mockWorld = getMockWorld("world");
        Location playerLoc = new Location(mockWorld, 0, 64, 0);
        List<ShopDirectoryEntry> results = ShopSearchService.search(index, "diamond", defaultConfig(), playerLoc, "world");
        assertEquals(1, results.size());
        assertEquals("2", results.get(0).shopId());
    }

    @Test
    void disabledWorldIsExcluded() {
        List<ShopDirectoryEntry> index = List.of(
                entry("1", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "creative", 0)
        );
        World mockWorld = getMockWorld("world");
        Location playerLoc = new Location(mockWorld, 0, 64, 0);
        List<ShopDirectoryEntry> results = ShopSearchService.search(index, "diamond", defaultConfig(), playerLoc, "world");
        assertTrue(results.isEmpty());
    }

    @Test
    void emptyWorldsListAllowsAllWorlds() {
        List<ShopDirectoryEntry> index = List.of(
                entry("1", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 0),
                entry("2", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "creative", 0)
        );
        ShopDirectoryConfig config = new ShopDirectoryConfig(true, true, true, 8, List.of(), true, 5, 10L, true, true, true);
        World mockWorld = getMockWorld("world");
        Location playerLoc = new Location(mockWorld, 0, 64, 0);
        List<ShopDirectoryEntry> results = ShopSearchService.search(index, "diamond", config, playerLoc, "world");
        assertEquals(2, results.size());
    }

    @Test
    void sortsByPriceThenDistance() {
        List<ShopDirectoryEntry> index = List.of(
                entry("far-cheap", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 100),
                entry("near-cheap", "Diamond", 10, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 5),
                entry("expensive", "Diamond", 20, 5, ShopDirectoryEntry.ShopKind.SELLING, "world", 0)
        );
        World mockWorld = getMockWorld("world");
        Location playerLoc = new Location(mockWorld, 0, 64, 0);
        List<ShopDirectoryEntry> results = ShopSearchService.search(index, "diamond", defaultConfig(), playerLoc, "world");
        assertEquals(List.of("near-cheap", "far-cheap", "expensive"),
                results.stream().map(ShopDirectoryEntry::shopId).toList());
    }
}
