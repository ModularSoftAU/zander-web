package dev.anchorlight.zander.velocity.bridge;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Simple per-player cooldown gate for connection requests arriving over the bridge. */
public class RateLimiter {
    private final long cooldownMs;
    private final Map<UUID, Long> lastAcquiredAt = new ConcurrentHashMap<>();

    public RateLimiter(long cooldownMs) {
        this.cooldownMs = cooldownMs;
    }

    public boolean tryAcquire(UUID playerId) {
        long now = System.currentTimeMillis();
        Long last = lastAcquiredAt.get(playerId);
        if (last != null && now - last < cooldownMs) {
            return false;
        }
        lastAcquiredAt.put(playerId, now);
        return true;
    }

    public void clear(UUID playerId) {
        lastAcquiredAt.remove(playerId);
    }
}
