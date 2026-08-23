package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.portal.PortalRegion;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Tracks each admin's in-progress two-point portal selection, keyed by admin UUID. */
public class PortalSelectionManager {
    private record Point(String world, int x, int y, int z) {
    }

    private final Map<UUID, Point> pos1 = new ConcurrentHashMap<>();
    private final Map<UUID, Point> pos2 = new ConcurrentHashMap<>();

    public void setPos1(UUID admin, String world, int x, int y, int z) {
        pos1.put(admin, new Point(world, x, y, z));
    }

    public void setPos2(UUID admin, String world, int x, int y, int z) {
        pos2.put(admin, new Point(world, x, y, z));
    }

    public Optional<PortalRegion> buildRegion(UUID admin) {
        Point a = pos1.get(admin);
        Point b = pos2.get(admin);
        if (a == null || b == null || !a.world().equals(b.world())) {
            return Optional.empty();
        }
        return Optional.of(new PortalRegion(a.world(), a.x(), a.y(), a.z(), b.x(), b.y(), b.z()));
    }

    public void clear(UUID admin) {
        pos1.remove(admin);
        pos2.remove(admin);
    }
}
