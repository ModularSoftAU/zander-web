package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortalTransitionDetectorTest {
    private Portal portal(String id, PortalRegion region) {
        return new Portal(id, id, true, region, new ServerPortalDestination("s"), null, 0L, null, "s", "d");
    }

    private PortalTransitionDetector newDetector(Portal... portals) {
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(java.util.List.of(portals));
        return new PortalTransitionDetector(index, new PortalSessionManager());
    }

    @Test
    void enteringPortalFiresTransition() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        Optional<Portal> result = detector.onBlockMove(player, "world", 1, 61, 1);
        assertTrue(result.isPresent());
        assertEquals("survival", result.get().id());
    }

    @Test
    void stayingInsidePortalDoesNotRetrigger() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        assertTrue(detector.onBlockMove(player, "world", 1, 61, 1).isPresent());
        assertTrue(detector.onBlockMove(player, "world", 1, 61, 2).isEmpty());
    }

    @Test
    void leavingPortalClearsActiveState() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        detector.onBlockMove(player, "world", 1, 61, 1);
        detector.onBlockMove(player, "world", 10, 61, 10); // outside
        assertTrue(detector.onBlockMove(player, "world", 1, 61, 1).isPresent()); // re-enter fires again
    }

    @Test
    void movingOutsideNeverFiresTransition() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        assertTrue(detector.onBlockMove(player, "world", 10, 61, 10).isEmpty());
    }

    @Test
    void differentPlayersTrackedIndependently() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID playerA = UUID.randomUUID();
        UUID playerB = UUID.randomUUID();

        assertTrue(detector.onBlockMove(playerA, "world", 1, 61, 1).isPresent());
        assertTrue(detector.onBlockMove(playerB, "world", 1, 61, 1).isPresent());
    }
}
