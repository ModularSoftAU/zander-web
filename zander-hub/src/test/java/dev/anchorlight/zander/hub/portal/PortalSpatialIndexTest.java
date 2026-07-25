package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PortalSpatialIndexTest {
    private Portal portalIn(String id, PortalRegion region) {
        return new Portal(id, id, true, region, new ServerPortalDestination("s"), null, 0L, null, "s", "d");
    }

    @Test
    void singleChunkPortalIsFoundInItsChunk() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        Portal portal = portalIn("survival", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));

        List<Portal> candidates = index.candidatesFor("world", 0, 0); // block 10 -> chunk 0
        assertEquals(1, candidates.size());
        assertEquals("survival", candidates.get(0).id());
    }

    @Test
    void emptyChunkReturnsEmptyList() {
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of());
        assertTrue(index.candidatesFor("world", 5, 5).isEmpty());
    }

    @Test
    void multiChunkPortalIsFoundInEveryIntersectedChunk() {
        // x -1..17 spans chunk -1, 0, 1
        PortalRegion region = new PortalRegion("world", -1, 60, 0, 17, 70, 0);
        Portal portal = portalIn("wide", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));

        assertEquals(1, index.candidatesFor("world", -1, 0).size());
        assertEquals(1, index.candidatesFor("world", 0, 0).size());
        assertEquals(1, index.candidatesFor("world", 1, 0).size());
    }

    @Test
    void differentWorldsAreIsolated() {
        PortalRegion region = new PortalRegion("world_nether", 0, 60, 0, 1, 61, 1);
        Portal portal = portalIn("p", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));

        assertTrue(index.candidatesFor("world", 0, 0).isEmpty());
        assertEquals(1, index.candidatesFor("world_nether", 0, 0).size());
    }

    @Test
    void rebuildReplacesPreviousContents() {
        PortalRegion region = new PortalRegion("world", 0, 60, 0, 1, 61, 1);
        Portal portal = portalIn("p", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));
        assertEquals(1, index.candidatesFor("world", 0, 0).size());

        index.rebuild(List.of());
        assertTrue(index.candidatesFor("world", 0, 0).isEmpty());
    }
}
