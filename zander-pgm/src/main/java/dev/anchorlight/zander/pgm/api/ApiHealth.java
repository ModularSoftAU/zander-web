package dev.anchorlight.zander.pgm.api;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/** Thread-safe view of connectivity to zander-web. */
public class ApiHealth {

    private final AtomicBoolean restReachable = new AtomicBoolean(false);
    private final AtomicBoolean websocketConnected = new AtomicBoolean(false);
    private final AtomicLong lastSuccessMillis = new AtomicLong(0);
    private final AtomicLong lastFailureMillis = new AtomicLong(0);

    public boolean isRestReachable() {
        return restReachable.get();
    }

    public boolean isWebsocketConnected() {
        return websocketConnected.get();
    }

    public void markRestSuccess() {
        restReachable.set(true);
        lastSuccessMillis.set(System.currentTimeMillis());
    }

    public void markRestFailure() {
        restReachable.set(false);
        lastFailureMillis.set(System.currentTimeMillis());
    }

    public void setWebsocketConnected(boolean connected) {
        websocketConnected.set(connected);
    }

    public long lastSuccessMillis() {
        return lastSuccessMillis.get();
    }

    public long lastFailureMillis() {
        return lastFailureMillis.get();
    }
}
