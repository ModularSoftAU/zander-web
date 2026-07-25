package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.portal.PortalRegion;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortalSelectionManagerTest {
    @Test
    void noRegionUntilBothPositionsSet() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        assertTrue(selections.buildRegion(admin).isEmpty());
    }

    @Test
    void buildsRegionFromBothPositions() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        selections.setPos2(admin, "world", 2, 62, 2);

        Optional<PortalRegion> region = selections.buildRegion(admin);
        assertTrue(region.isPresent());
        assertEquals(0, region.get().minX());
        assertEquals(2, region.get().maxX());
    }

    @Test
    void rejectsMismatchedWorlds() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        selections.setPos2(admin, "world_nether", 2, 62, 2);
        assertTrue(selections.buildRegion(admin).isEmpty());
    }

    @Test
    void selectionsArePerAdmin() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID adminA = UUID.randomUUID();
        UUID adminB = UUID.randomUUID();
        selections.setPos1(adminA, "world", 0, 60, 0);
        selections.setPos2(adminA, "world", 2, 62, 2);
        assertTrue(selections.buildRegion(adminA).isPresent());
        assertTrue(selections.buildRegion(adminB).isEmpty());
    }

    @Test
    void clearRemovesBothPositions() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        selections.setPos2(admin, "world", 2, 62, 2);
        selections.clear(admin);
        assertTrue(selections.buildRegion(admin).isEmpty());
    }
}
