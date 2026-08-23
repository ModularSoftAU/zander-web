package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PortalRegionTest {
    @Test
    void normalisesInvertedCorners() {
        PortalRegion region = new PortalRegion("world", 12, 124, 5, 10, 120, 5);
        assertEquals(10, region.minX());
        assertEquals(12, region.maxX());
        assertEquals(120, region.minY());
        assertEquals(124, region.maxY());
    }

    @Test
    void containsInsidePoint() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        assertTrue(region.contains(11, 122, 5));
    }

    @Test
    void containsBoundaryPoints() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        assertTrue(region.contains(10, 120, 5));
        assertTrue(region.contains(12, 124, 5));
    }

    @Test
    void excludesOutsidePoint() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        assertFalse(region.contains(13, 122, 5));
        assertFalse(region.contains(11, 125, 5));
    }

    @Test
    void handlesNegativeCoordinates() {
        PortalRegion region = new PortalRegion("world", -20, 60, -8, -10, 70, -2);
        assertTrue(region.contains(-15, 65, -5));
        assertFalse(region.contains(-25, 65, -5));
    }

    @Test
    void computesChunkSpanAcrossBoundary() {
        // x -1..17 spans chunk -1 (blocks -16..-1) through chunk 1 (blocks 16..31)
        PortalRegion region = new PortalRegion("world", -1, 60, 0, 17, 70, 0);
        assertEquals(-1, region.minChunkX());
        assertEquals(1, region.maxChunkX());
    }

    @Test
    void singleChunkRegionHasEqualMinMaxChunk() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 6);
        assertEquals(region.minChunkX(), region.maxChunkX());
        assertEquals(region.minChunkZ(), region.maxChunkZ());
    }
}
