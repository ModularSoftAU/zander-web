package dev.anchorlight.zander.pgm.api;

import dev.anchorlight.zander.pgm.api.dto.BridgeEvent;
import dev.anchorlight.zander.pgm.util.SafeLogger;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Bounded in-memory queue of events that failed to reach zander-web. When full,
 * the oldest event is dropped (and counted) so the server never runs out of
 * memory while zander-web is offline.
 */
public class EventQueue {

    private final ConcurrentLinkedDeque<BridgeEvent> queue = new ConcurrentLinkedDeque<>();
    private final int maxSize;
    private final SafeLogger logger;
    private final AtomicLong droppedCount = new AtomicLong(0);

    public EventQueue(int maxSize, SafeLogger logger) {
        this.maxSize = Math.max(1, maxSize);
        this.logger = logger;
    }

    public void offer(BridgeEvent event) {
        queue.addLast(event);
        while (queue.size() > maxSize) {
            BridgeEvent dropped = queue.pollFirst();
            if (dropped != null) {
                long total = droppedCount.incrementAndGet();
                // Only log occasionally to avoid console spam.
                if (total == 1 || total % 100 == 0) {
                    logger.warn("Event queue full; dropped oldest event (total dropped: " + total + ")");
                }
            }
        }
    }

    /** Remove and return up to {@code max} events for a retry attempt. */
    public List<BridgeEvent> drain(int max) {
        List<BridgeEvent> batch = new ArrayList<>();
        for (int i = 0; i < max; i++) {
            BridgeEvent e = queue.pollFirst();
            if (e == null) {
                break;
            }
            batch.add(e);
        }
        return batch;
    }

    /** Return events to the front of the queue after a failed retry. */
    public void requeueFront(List<BridgeEvent> events) {
        for (int i = events.size() - 1; i >= 0; i--) {
            queue.addFirst(events.get(i));
        }
    }

    public int size() {
        return queue.size();
    }

    public long droppedCount() {
        return droppedCount.get();
    }

    public boolean isEmpty() {
        return queue.isEmpty();
    }
}
