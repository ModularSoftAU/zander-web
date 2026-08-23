package dev.anchorlight.zander.hub.portal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Pure enter/exit edge-detection logic shared by the Bukkit movement listener, kept free of
 * Bukkit types so it's directly unit-testable.
 */
public class PortalTransitionDetector {
    private final PortalSpatialIndex index;
    private final PortalSessionManager sessions;

    public PortalTransitionDetector(PortalSpatialIndex index, PortalSessionManager sessions) {
        this.index = index;
        this.sessions = sessions;
    }

    /** Returns the newly-entered portal, or empty if the player didn't just cross into one. */
    public Optional<Portal> onBlockMove(UUID player, String world, int x, int y, int z) {
        List<Portal> candidates = index.candidatesFor(world, x >> 4, z >> 4);
        Portal current = null;
        for (Portal candidate : candidates) {
            if (candidate.enabled() && candidate.region().contains(x, y, z)) {
                current = candidate;
                break;
            }
        }

        Optional<String> activeId = sessions.getActivePortalId(player);
        if (current == null) {
            if (activeId.isPresent()) {
                sessions.clearActivePortalId(player);
            }
            return Optional.empty();
        }

        if (activeId.isPresent() && activeId.get().equals(current.id())) {
            return Optional.empty(); // still inside the same portal, no retrigger
        }

        sessions.setActivePortalId(player, current.id());
        return Optional.of(current);
    }
}
