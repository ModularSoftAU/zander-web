package dev.anchorlight.zander.hub.portal;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Buckets portals by (world, chunk) so movement detection only scans portals that could
 * plausibly contain the player's current block, instead of every loaded portal.
 */
public class PortalSpatialIndex {
    private volatile Map<String, Map<Long, List<Portal>>> index = Collections.emptyMap();

    public synchronized void rebuild(Collection<Portal> portals) {
        Map<String, Map<Long, List<Portal>>> next = new HashMap<>();
        for (Portal portal : portals) {
            PortalRegion region = portal.region();
            Map<Long, List<Portal>> worldBuckets =
                    next.computeIfAbsent(region.world(), key -> new HashMap<>());
            for (int chunkX = region.minChunkX(); chunkX <= region.maxChunkX(); chunkX++) {
                for (int chunkZ = region.minChunkZ(); chunkZ <= region.maxChunkZ(); chunkZ++) {
                    worldBuckets.computeIfAbsent(chunkKey(chunkX, chunkZ), key -> new ArrayList<>()).add(portal);
                }
            }
        }
        this.index = next;
    }

    public List<Portal> candidatesFor(String world, int chunkX, int chunkZ) {
        Map<Long, List<Portal>> worldBuckets = index.get(world);
        if (worldBuckets == null) {
            return List.of();
        }
        List<Portal> candidates = worldBuckets.get(chunkKey(chunkX, chunkZ));
        return candidates == null ? List.of() : candidates;
    }

    private static long chunkKey(int chunkX, int chunkZ) {
        return (((long) chunkX) << 32) ^ (chunkZ & 0xffffffffL);
    }
}
