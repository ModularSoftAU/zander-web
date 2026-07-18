package org.modularsoft.zander.pgm.api;

import org.modularsoft.zander.pgm.config.ZanderPGMConfig;
import org.modularsoft.zander.pgm.api.dto.BridgeEvent;
import org.modularsoft.zander.pgm.util.JsonUtil;
import org.modularsoft.zander.pgm.util.SafeLogger;
import org.modularsoft.zander.pgm.util.TimeUtil;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Async REST client for zander-web Mixed ingestion endpoints. All calls run
 * off the main thread via the JDK {@link HttpClient} executor and never throw
 * into the caller. Failed generic events are pushed onto the
 * {@link EventQueue} for later retry.
 */
public class ZanderApiClient {

    private final ZanderPGMConfig config;
    private final ApiHealth health;
    private final EventQueue queue;
    private final SafeLogger logger;
    private final String pluginVersion;
    private final HttpClient http;

    public ZanderApiClient(ZanderPGMConfig config, ApiHealth health, EventQueue queue,
                           SafeLogger logger, String pluginVersion) {
        this.config = config;
        this.health = health;
        this.queue = queue;
        this.logger = logger;
        this.pluginVersion = pluginVersion;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(config.connectTimeoutSeconds))
                .build();
    }

    private void stamp(BridgeEvent event) {
        event.serverId = config.serverId;
        event.pluginVersion = pluginVersion;
        if (event.timestamp == 0) {
            event.timestamp = TimeUtil.now();
        }
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder()
                .uri(URI.create(resolveUrl(config.baseUrl, path)))
                .timeout(Duration.ofSeconds(config.requestTimeoutSeconds))
                .header("Content-Type", "application/json")
                .header("Authorization", bearerToken(config.token))
                .header("X-Server-Id", config.serverId)
                .header("X-Plugin-Version", pluginVersion);
    }

    static String bearerToken(String token) {
        return "Bearer " + token;
    }

    static String resolveUrl(String baseUrl, String path) {
        String normalizedBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        if (normalizedBase.endsWith("/api") && path.startsWith("/api/")) {
            return normalizedBase.substring(0, normalizedBase.length() - 4) + path;
        }
        return normalizedBase + path;
    }

    /** POST an arbitrary body to a path. Never throws; returns success flag. */
    public CompletableFuture<Boolean> post(String path, Object body) {
        HttpRequest req;
        try {
            req = request(path)
                    .POST(HttpRequest.BodyPublishers.ofString(JsonUtil.toJson(body)))
                    .build();
        } catch (Exception e) {
            logger.warn("Failed to build POST " + path + ": " + e.getMessage());
            return CompletableFuture.completedFuture(false);
        }
        logger.debug("POST " + path);
        return http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .handle((resp, err) -> {
                    if (err != null) {
                        health.markRestFailure();
                        logger.warn("POST " + path + " failed: " + err.getMessage());
                        return false;
                    }
                    if (resp.statusCode() >= 300) {
                        health.markRestFailure();
                        logger.warn("POST " + path + " returned HTTP " + resp.statusCode()
                                + ": " + truncate(resp.body()));
                        return false;
                    }
                    health.markRestSuccess();
                    logger.debug("POST " + path + " succeeded (" + resp.statusCode() + ")");
                    return true;
                });
    }

    /** GET a path and return the response body, or null on failure. */
    public CompletableFuture<String> get(String path) {
        HttpRequest req;
        try {
            req = request(path).GET().build();
        } catch (Exception e) {
            logger.warn("Failed to build GET " + path + ": " + e.getMessage());
            return CompletableFuture.completedFuture(null);
        }
        logger.debug("GET " + path);
        return http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .handle((resp, err) -> {
                    if (err != null) {
                        health.markRestFailure();
                        logger.warn("GET " + path + " failed: " + err.getMessage());
                        return null;
                    }
                    if (resp.statusCode() >= 300) {
                        health.markRestFailure();
                        logger.warn("GET " + path + " returned HTTP " + resp.statusCode()
                                + ": " + truncate(resp.body()));
                        return null;
                    }
                    health.markRestSuccess();
                    logger.debug("GET " + path + " succeeded (" + resp.statusCode() + ")");
                    return resp.body();
                });
    }

    private static String truncate(String body) {
        if (body == null) {
            return "";
        }
        return body.length() > 300 ? body.substring(0, 300) + "..." : body;
    }

    /**
     * Send a generic bridge event to {@code /api/mixed/events}. On failure the
     * event is queued for retry when {@code retryFailedEvents} is enabled.
     */
    public void send(BridgeEvent event) {
        stamp(event);
        post("/api/mixed/events", event).thenAccept(ok -> {
            if (!ok) {
                if (config.retryFailedEvents) {
                    logger.warn("Queuing " + event.type + " event for retry (queue size " + queue.size() + ")");
                    queue.offer(event);
                } else {
                    logger.warn("Dropping " + event.type + " event (retryFailedEvents disabled)");
                }
            }
        });
    }

    /** Attempt to send a batch; returns whether the whole batch succeeded. */
    public CompletableFuture<Boolean> sendBatch(List<BridgeEvent> events) {
        for (BridgeEvent e : events) {
            stamp(e);
        }
        return post("/api/mixed/events/batch", events);
    }

    // --- Specialised endpoints -------------------------------------------------

    public void heartbeat(BridgeEvent event) {
        stamp(event);
        post("/api/mixed/servers/heartbeat", event);
    }

    public CompletableFuture<Boolean> offline(BridgeEvent event) {
        stamp(event);
        return post("/api/mixed/servers/offline", event);
    }

    public void statsPlayer(Object dto) {
        post("/api/mixed/stats/player", dto);
    }

    public void statsMatch(Object dto) {
        post("/api/mixed/stats/match", dto);
    }

    public void statsMap(Object dto) {
        post("/api/mixed/stats/map", dto);
    }

    public void xp(Object dto) {
        post("/api/mixed/xp", dto);
    }

    public void achievement(Object dto) {
        post("/api/mixed/achievements", dto);
    }

    public CompletableFuture<String> pendingMapTokenRequests() {
        return get("/api/mixed/map-token-requests/pending");
    }

    public void mapTokenResult(String id, Object dto) {
        post("/api/mixed/map-token-requests/" + id + "/result", dto);
    }

    /** Fetches a player's live Map Token balance from the web-side ledger. */
    public CompletableFuture<String> getMapTokens(String uuid, String username) {
        return get("/api/mixed/map-tokens/balance?uuid=" + uuid + "&username=" + username);
    }

    /** Submits a self-service Map Token spend (nominate/set_next/sponsor) against the web-side ledger. */
    public CompletableFuture<String> requestMapToken(String uuid, String username, String mapKey, String actionType) {
        Map<String, Object> body = new HashMap<>();
        body.put("uuid", uuid);
        body.put("username", username);
        body.put("mapKey", mapKey);
        body.put("action", actionType);
        HttpRequest req;
        try {
            req = request("/api/mixed/map-tokens/request")
                    .POST(HttpRequest.BodyPublishers.ofString(JsonUtil.toJson(body)))
                    .build();
        } catch (Exception e) {
            logger.warn("Failed to build map token request: " + e.getMessage());
            return CompletableFuture.completedFuture(null);
        }
        return http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .handle((resp, err) -> {
                    if (err != null) {
                        health.markRestFailure();
                        logger.warn("Map token request failed: " + err.getMessage());
                        return null;
                    }
                    health.markRestSuccess();
                    return resp.body();
                });
    }

    public CompletableFuture<String> currentVote() {
        return get("/api/mixed/vote/current");
    }

    public void castVote(Object dto) {
        post("/api/mixed/vote/cast", dto);
    }

    public void submitRating(String mapKey, Object dto) {
        post("/api/mixed/maps/" + mapKey + "/ratings", dto);
    }
}
