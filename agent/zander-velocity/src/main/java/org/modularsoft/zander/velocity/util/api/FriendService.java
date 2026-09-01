package org.modularsoft.zander.velocity.util.api;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.slf4j.Logger;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * HTTP client for the friends token API ({@code /api/friends/*}, {@code /api/blocks/*},
 * {@code /api/settings}). The proxy owns no database connection, so this is the
 * only source of truth.
 *
 * <p>A short-TTL cache of each online player's friend list, blocks and settings
 * cuts request volume; {@link #refresh(UUID)} warms it on login and
 * {@link #invalidate(UUID)} drops it after a local mutation.</p>
 *
 * <p>Failure behaviour differs by call and matters:</p>
 * <ul>
 *   <li>friend-list read fails &rarr; fail <b>open</b> (return what we have, or empty)</li>
 *   <li>block / settings check fails &rarr; fail <b>closed</b> (treat as blocked /
 *       messaging disabled) — losing a DM beats delivering one to someone who
 *       blocked the sender</li>
 * </ul>
 *
 * <p>Every method here performs blocking HTTP. Callers MUST invoke them off the
 * main thread (see the command handlers and {@code UserOnLogin}).</p>
 */
public class FriendService {

    private static final long CACHE_TTL_MS = 45_000L;

    private final Logger logger;

    private final Map<UUID, Cached<List<String>>> friendCache = new ConcurrentHashMap<>();
    private final Map<UUID, Cached<Set<String>>> blockCache = new ConcurrentHashMap<>();
    private final Map<UUID, Cached<Settings>> settingsCache = new ConcurrentHashMap<>();

    public FriendService(Logger logger) {
        this.logger = logger;
    }

    private record Cached<T>(T value, long expiry) {
        boolean fresh() {
            return System.currentTimeMillis() < expiry;
        }
    }

    /** Outcome of a mutating call, surfaced to the player verbatim. */
    public record ApiResult(boolean success, String message) {
    }

    public record Settings(
            String allowMessagesFrom,
            String allowFriendRequests,
            boolean friendsListVisible,
            boolean notifyFriendJoin,
            boolean notifyFriendRequest
    ) {
        public static Settings defaults() {
            return new Settings("everyone", "everyone", true, true, true);
        }
    }

    // ------------------------------------------------------------------
    // Low-level HTTP
    // ------------------------------------------------------------------

    private String baseUrl() {
        return ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
    }

    private String apiKey() {
        return ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private JsonObject httpGet(String path) {
        Response res = Request.builder()
                .setURL(baseUrl() + path)
                .setMethod(Request.Method.GET)
                .addHeader("x-access-token", apiKey())
                .build()
                .execute();
        return parse(res);
    }

    private JsonObject httpPost(String path, JsonObject body) {
        Response res = Request.builder()
                .setURL(baseUrl() + path)
                .setMethod(Request.Method.POST)
                .addHeader("x-access-token", apiKey())
                .setRequestBody(body.toString())
                .build()
                .execute();
        return parse(res);
    }

    private JsonObject parse(Response res) {
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new RuntimeException("HTTP " + res.getStatusCode() + ": " + res.getBody());
        }
        JsonElement el = JsonParser.parseString(res.getBody());
        if (!el.isJsonObject()) {
            throw new RuntimeException("Unexpected response body: " + res.getBody());
        }
        return el.getAsJsonObject();
    }

    private static String str(JsonObject o, String key, String fallback) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : fallback;
    }

    private static boolean bool(JsonObject o, String key, boolean fallback) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsBoolean() : fallback;
    }

    // ------------------------------------------------------------------
    // Fetchers
    // ------------------------------------------------------------------

    private List<String> fetchFriends(UUID uuid) {
        JsonObject body = httpGet("/api/friends/list?uuid=" + enc(uuid.toString()));
        List<String> names = new ArrayList<>();
        if (body.has("data") && body.get("data").isJsonArray()) {
            for (JsonElement e : body.getAsJsonArray("data")) {
                names.add(e.getAsJsonObject().get("username").getAsString());
            }
        }
        return names;
    }

    private Set<String> fetchBlocks(UUID uuid) {
        JsonObject body = httpGet("/api/blocks/list?uuid=" + enc(uuid.toString()));
        Set<String> names = new HashSet<>();
        if (body.has("data") && body.get("data").isJsonArray()) {
            for (JsonElement e : body.getAsJsonArray("data")) {
                names.add(e.getAsJsonObject().get("username").getAsString().toLowerCase());
            }
        }
        return names;
    }

    private Settings fetchSettings(UUID uuid) {
        JsonObject body = httpGet("/api/settings?uuid=" + enc(uuid.toString()));
        JsonObject d = body.has("data") && body.get("data").isJsonObject()
                ? body.getAsJsonObject("data")
                : new JsonObject();
        return new Settings(
                str(d, "allowMessagesFrom", "everyone"),
                str(d, "allowFriendRequests", "everyone"),
                bool(d, "friendsListVisible", true),
                bool(d, "notifyFriendJoin", true),
                bool(d, "notifyFriendRequest", true)
        );
    }

    // ------------------------------------------------------------------
    // Cache lifecycle
    // ------------------------------------------------------------------

    /** Warm every cache for a player. Best-effort; failures are logged, not thrown. */
    public void refresh(UUID uuid) {
        long expiry = System.currentTimeMillis() + CACHE_TTL_MS;
        try {
            friendCache.put(uuid, new Cached<>(fetchFriends(uuid), expiry));
        } catch (Exception e) {
            logger.warn("[friends] refresh: friend list for {} failed: {}", uuid, e.getMessage());
        }
        try {
            blockCache.put(uuid, new Cached<>(fetchBlocks(uuid), expiry));
        } catch (Exception e) {
            logger.warn("[friends] refresh: blocks for {} failed: {}", uuid, e.getMessage());
        }
        try {
            settingsCache.put(uuid, new Cached<>(fetchSettings(uuid), expiry));
        } catch (Exception e) {
            logger.warn("[friends] refresh: settings for {} failed: {}", uuid, e.getMessage());
        }
    }

    public void invalidate(UUID uuid) {
        friendCache.remove(uuid);
        blockCache.remove(uuid);
        settingsCache.remove(uuid);
    }

    // ------------------------------------------------------------------
    // Cached reads
    // ------------------------------------------------------------------

    /** Fail-OPEN: returns the freshest data available, or an empty list on total failure. */
    public List<String> getFriends(UUID uuid) {
        Cached<List<String>> c = friendCache.get(uuid);
        if (c != null && c.fresh()) {
            return c.value();
        }
        try {
            List<String> fresh = fetchFriends(uuid);
            friendCache.put(uuid, new Cached<>(fresh, System.currentTimeMillis() + CACHE_TTL_MS));
            return fresh;
        } catch (Exception e) {
            logger.warn("[friends] getFriends {} failed, failing open: {}", uuid, e.getMessage());
            return c != null ? c.value() : List.of();
        }
    }

    public boolean isFriend(UUID uuid, String name) {
        String lower = name.toLowerCase();
        return getFriends(uuid).stream().anyMatch(n -> n.equalsIgnoreCase(lower));
    }

    /**
     * Fail-CLOSED: on any uncertainty this returns {@code true} (treat as blocked)
     * so a DM is never delivered to someone who may have blocked the sender.
     */
    public boolean isBlocked(UUID uuid, String targetName) {
        String lower = targetName.toLowerCase();
        Cached<Set<String>> c = blockCache.get(uuid);
        if (c != null && c.fresh()) {
            return c.value().contains(lower);
        }
        try {
            Set<String> fresh = fetchBlocks(uuid);
            blockCache.put(uuid, new Cached<>(fresh, System.currentTimeMillis() + CACHE_TTL_MS));
            return fresh.contains(lower);
        } catch (Exception e) {
            logger.warn("[friends] isBlocked {} failed, failing closed: {}", uuid, e.getMessage());
            return true;
        }
    }

    public Set<String> getBlocks(UUID uuid) {
        Cached<Set<String>> c = blockCache.get(uuid);
        if (c != null && c.fresh()) {
            return c.value();
        }
        try {
            Set<String> fresh = fetchBlocks(uuid);
            blockCache.put(uuid, new Cached<>(fresh, System.currentTimeMillis() + CACHE_TTL_MS));
            return fresh;
        } catch (Exception e) {
            logger.warn("[friends] getBlocks {} failed, failing closed (empty): {}", uuid, e.getMessage());
            return Set.of();
        }
    }

    /**
     * Fail-CLOSED: {@link Optional#empty()} on failure. The messaging path treats
     * empty as "drop the message".
     */
    public Optional<Settings> getSettings(UUID uuid) {
        Cached<Settings> c = settingsCache.get(uuid);
        if (c != null && c.fresh()) {
            return Optional.of(c.value());
        }
        try {
            Settings fresh = fetchSettings(uuid);
            settingsCache.put(uuid, new Cached<>(fresh, System.currentTimeMillis() + CACHE_TTL_MS));
            return Optional.of(fresh);
        } catch (Exception e) {
            logger.warn("[friends] getSettings {} failed, failing closed: {}", uuid, e.getMessage());
            return Optional.empty();
        }
    }

    // ------------------------------------------------------------------
    // Mutations — each returns an ApiResult for the player
    // ------------------------------------------------------------------

    private ApiResult mutate(String path, JsonObject body, String genericError) {
        try {
            JsonObject res = httpPost(path, body);
            return new ApiResult(bool(res, "success", false), str(res, "message", ""));
        } catch (Exception e) {
            logger.warn("[friends] {} failed: {}", path, e.getMessage());
            return new ApiResult(false, genericError);
        }
    }

    private static JsonObject withActorAndTarget(UUID uuid, String targetName) {
        JsonObject b = new JsonObject();
        b.addProperty("uuid", uuid.toString());
        b.addProperty("targetName", targetName);
        return b;
    }

    public ApiResult sendRequest(UUID uuid, String targetName) {
        return mutate("/api/friends/request", withActorAndTarget(uuid, targetName),
                "Could not send that friend request.");
    }

    public ApiResult acceptRequest(UUID uuid, String targetName) {
        return mutate("/api/friends/accept", withActorAndTarget(uuid, targetName),
                "Could not accept that request.");
    }

    public ApiResult declineRequest(UUID uuid, String targetName) {
        return mutate("/api/friends/decline", withActorAndTarget(uuid, targetName),
                "Could not decline that request.");
    }

    public ApiResult removeFriend(UUID uuid, String targetName) {
        return mutate("/api/friends/remove", withActorAndTarget(uuid, targetName),
                "Could not update your friends list.");
    }

    public ApiResult addBlock(UUID uuid, String targetName) {
        return mutate("/api/blocks/add", withActorAndTarget(uuid, targetName),
                "Could not block that player.");
    }

    public ApiResult removeBlock(UUID uuid, String targetName) {
        return mutate("/api/blocks/remove", withActorAndTarget(uuid, targetName),
                "Could not unblock that player.");
    }

    public ApiResult updateSettings(UUID uuid, Map<String, Object> patch) {
        JsonObject b = new JsonObject();
        b.addProperty("uuid", uuid.toString());
        for (Map.Entry<String, Object> e : patch.entrySet()) {
            Object v = e.getValue();
            if (v instanceof Boolean bv) {
                b.addProperty(e.getKey(), bv);
            } else {
                b.addProperty(e.getKey(), String.valueOf(v));
            }
        }
        return mutate("/api/settings", b, "Could not update settings.");
    }

    // ------------------------------------------------------------------
    // Pending requests + offline delivery (used by /friend requests and login)
    // ------------------------------------------------------------------

    public List<String> pendingIncoming(UUID uuid) {
        try {
            JsonObject body = httpGet("/api/friends/pending?uuid=" + enc(uuid.toString()));
            List<String> names = new ArrayList<>();
            JsonObject d = body.getAsJsonObject("data");
            if (d != null && d.has("incoming") && d.get("incoming").isJsonArray()) {
                for (JsonElement e : d.getAsJsonArray("incoming")) {
                    names.add(e.getAsJsonObject().get("username").getAsString());
                }
            }
            return names;
        } catch (Exception e) {
            logger.warn("[friends] pendingIncoming {} failed: {}", uuid, e.getMessage());
            return List.of();
        }
    }

    /**
     * Ack undelivered pending requests and return the requester names that were
     * waiting, so the caller can tell the joining player about them.
     */
    public List<String> consumeUndelivered(UUID uuid) {
        try {
            JsonObject b = new JsonObject();
            b.addProperty("uuid", uuid.toString());
            JsonObject body = httpPost("/api/friends/delivered", b);
            List<String> names = new ArrayList<>();
            JsonObject d = body.has("data") ? body.getAsJsonObject("data") : null;
            if (d != null && d.has("delivered") && d.get("delivered").isJsonArray()) {
                for (JsonElement e : d.getAsJsonArray("delivered")) {
                    names.add(e.getAsJsonObject().get("username").getAsString());
                }
            }
            return names;
        } catch (Exception e) {
            logger.warn("[friends] consumeUndelivered {} failed: {}", uuid, e.getMessage());
            return List.of();
        }
    }

    /** Friend usernames the API reports as online (already vanish-filtered server-side). */
    public Set<String> onlineFriends(UUID uuid) {
        try {
            JsonObject body = httpGet("/api/friends/online?uuid=" + enc(uuid.toString()));
            Set<String> names = new HashSet<>();
            if (body.has("data") && body.get("data").isJsonArray()) {
                for (JsonElement e : body.getAsJsonArray("data")) {
                    names.add(e.getAsJsonObject().get("username").getAsString());
                }
            }
            return names;
        } catch (Exception e) {
            logger.warn("[friends] onlineFriends {} failed, failing open (empty): {}", uuid, e.getMessage());
            return Set.of();
        }
    }
}
