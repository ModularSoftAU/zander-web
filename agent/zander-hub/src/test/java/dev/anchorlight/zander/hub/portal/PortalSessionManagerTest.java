package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortalSessionManagerTest {
    @Test
    void activePortalStartsEmpty() {
        PortalSessionManager sessions = new PortalSessionManager();
        assertTrue(sessions.getActivePortalId(UUID.randomUUID()).isEmpty());
    }

    @Test
    void setAndClearActivePortal() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.setActivePortalId(player, "survival");
        assertEquals("survival", sessions.getActivePortalId(player).orElseThrow());
        sessions.clearActivePortalId(player);
        assertTrue(sessions.getActivePortalId(player).isEmpty());
    }

    @Test
    void cooldownBlocksImmediateRetrigger() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.markTriggered(player, "survival", 1000L, 2000L);
        assertTrue(sessions.isOnCooldown(player, "survival", 1500L));
        assertFalse(sessions.isOnCooldown(player, "survival", 3001L));
    }

    @Test
    void cooldownIsPerPortal() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.markTriggered(player, "survival", 1000L, 2000L);
        assertFalse(sessions.isOnCooldown(player, "events", 1500L));
    }

    @Test
    void loopSuppressionExpires() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.suppressUntil(player, 1000L);
        assertTrue(sessions.isSuppressed(player, 999L));
        assertFalse(sessions.isSuppressed(player, 1000L));
    }

    @Test
    void connectPendingIsExclusiveUntilCleared() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        assertTrue(sessions.tryMarkConnectPending(player));
        assertFalse(sessions.tryMarkConnectPending(player));
        sessions.clearConnectPending(player);
        assertTrue(sessions.tryMarkConnectPending(player));
    }

    @Test
    void clearRemovesAllState() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.setActivePortalId(player, "survival");
        sessions.tryMarkConnectPending(player);
        sessions.clear(player);
        assertTrue(sessions.getActivePortalId(player).isEmpty());
        assertTrue(sessions.tryMarkConnectPending(player));
    }
}
