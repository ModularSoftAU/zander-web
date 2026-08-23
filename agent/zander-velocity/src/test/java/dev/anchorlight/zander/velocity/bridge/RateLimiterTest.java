package dev.anchorlight.zander.velocity.bridge;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTest {
    @Test
    void firstRequestIsAllowed() {
        RateLimiter limiter = new RateLimiter(1000L);
        assertTrue(limiter.tryAcquire(UUID.randomUUID()));
    }

    @Test
    void secondImmediateRequestIsBlocked() {
        RateLimiter limiter = new RateLimiter(1000L);
        UUID id = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(id));
        assertFalse(limiter.tryAcquire(id));
    }

    @Test
    void differentPlayersAreIndependent() {
        RateLimiter limiter = new RateLimiter(1000L);
        assertTrue(limiter.tryAcquire(UUID.randomUUID()));
        assertTrue(limiter.tryAcquire(UUID.randomUUID()));
    }

    @Test
    void requestAllowedAgainAfterCooldownElapses() throws InterruptedException {
        RateLimiter limiter = new RateLimiter(20L);
        UUID id = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(id));
        Thread.sleep(30L);
        assertTrue(limiter.tryAcquire(id));
    }

    @Test
    void clearRemovesCooldownState() {
        RateLimiter limiter = new RateLimiter(10_000L);
        UUID id = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(id));
        limiter.clear(id);
        assertTrue(limiter.tryAcquire(id));
    }
}
