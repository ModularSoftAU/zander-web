package dev.anchorlight.zander.addon.navigation;

import dev.anchorlight.zander.addon.shop.ShopDirectoryEntry;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ShopNavigationSessionTest {

    private ShopDirectoryEntry entryAt(World world, double x, double y, double z) {
        return new ShopDirectoryEntry("shop-1", Material.DIAMOND, "Diamond", UUID.randomUUID(), "Ben",
                10.0, ShopDirectoryEntry.ShopKind.SELLING, 5, world.getName(), new Location(world, x, y, z));
    }

    @Test
    void distanceIsEuclidean() {
        World world = Mockito.mock(World.class);
        Mockito.when(world.getName()).thenReturn("world");
        ShopDirectoryEntry target = entryAt(world, 0, 64, 0);
        ShopNavigationSession session = new ShopNavigationSession(UUID.randomUUID(), target);

        Location playerLoc = new Location(world, 3, 64, 4); // 3-4-5 triangle
        assertEquals(5.0, session.distanceTo(playerLoc), 0.0001);
    }

    @Test
    void arrivesWithinThreshold() {
        World world = Mockito.mock(World.class);
        Mockito.when(world.getName()).thenReturn("world");
        ShopDirectoryEntry target = entryAt(world, 0, 64, 0);
        ShopNavigationSession session = new ShopNavigationSession(UUID.randomUUID(), target);

        assertTrue(session.hasArrived(new Location(world, 3, 64, 0), 5));
        assertFalse(session.hasArrived(new Location(world, 10, 64, 0), 5));
    }

    @Test
    void differentWorldThrows() {
        World worldA = Mockito.mock(World.class);
        Mockito.when(worldA.getName()).thenReturn("world");
        World worldB = Mockito.mock(World.class);
        Mockito.when(worldB.getName()).thenReturn("world_nether");
        ShopDirectoryEntry target = entryAt(worldA, 0, 64, 0);
        ShopNavigationSession session = new ShopNavigationSession(UUID.randomUUID(), target);

        assertThrows(IllegalArgumentException.class, () -> session.distanceTo(new Location(worldB, 0, 64, 0)));
    }
}
