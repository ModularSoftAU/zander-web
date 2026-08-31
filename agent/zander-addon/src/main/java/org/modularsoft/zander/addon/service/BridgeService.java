package org.modularsoft.zander.addon.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import org.modularsoft.zander.addon.ZanderAddonMain;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * HTTP client for the Zander web "bridge" endpoints:
 *
 *   Vote-reward command bridge  (POST <api-url>/command-bridge/claim|complete|fail)
 *   Executor task queue         (GET/POST <api-url>/bridge/processor/*)
 *
 * Both sit behind the web app's token auth, so every request carries the
 * x-access-token header (config: api-key, must match the web app's `apiKey`).
 * All methods are blocking and safe to call from an async thread.
 */
public class BridgeService {
    private final ZanderAddonMain plugin;
    private final Gson gson = new Gson();

    public BridgeService(ZanderAddonMain plugin) {
        this.plugin = plugin;
    }

    private String apiUrl() {
        String url = plugin.getConfig().getString("api-url", "");
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private String apiKey() {
        return plugin.getConfig().getString("api-key", "");
    }

    private String serverName() {
        return plugin.getConfig().getString("server-name", "");
    }

    // ---------------------------------------------------------------------
    // Vote-reward command bridge
    // ---------------------------------------------------------------------

    /** One queued reward command for a player. */
    public static final class RewardCommand {
        public final long id;
        public final String command;
        /** "console", "player"/"self", or null (treat as console). */
        public final String executeAs;

        RewardCommand(long id, String command, String executeAs) {
            this.id = id;
            this.command = command;
            this.executeAs = executeAs;
        }
    }

    /** Claim (atomically) any pending reward commands for this player on this server. */
    public List<RewardCommand> claimRewardCommands(String playerUuid, String playerName) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("playerUuid", playerUuid);
        body.addProperty("playerName", playerName);
        body.addProperty("serverName", serverName());

        JsonObject json = postJson("/command-bridge/claim", body);

        List<RewardCommand> out = new ArrayList<>();
        if (isSuccess(json) && json.has("commands") && json.get("commands").isJsonArray()) {
            for (JsonElement el : json.getAsJsonArray("commands")) {
                JsonObject c = el.getAsJsonObject();
                out.add(new RewardCommand(
                        c.get("id").getAsLong(),
                        c.get("command").getAsString(),
                        c.has("executeAs") && !c.get("executeAs").isJsonNull()
                                ? c.get("executeAs").getAsString()
                                : null));
            }
        }
        return out;
    }

    public void completeRewardCommands(String playerUuid, List<Long> ids) throws Exception {
        if (ids == null || ids.isEmpty()) return;
        JsonObject body = new JsonObject();
        body.addProperty("playerUuid", playerUuid);
        JsonArray arr = new JsonArray();
        ids.forEach(arr::add);
        body.add("completedCommandIds", arr);
        postJson("/command-bridge/complete", body);
    }

    /** {@code failures}: command id -> failure reason. */
    public void failRewardCommands(String playerUuid, Map<Long, String> failures) throws Exception {
        if (failures == null || failures.isEmpty()) return;
        JsonObject body = new JsonObject();
        body.addProperty("playerUuid", playerUuid);
        JsonArray arr = new JsonArray();
        failures.forEach((id, reason) -> {
            JsonObject f = new JsonObject();
            f.addProperty("id", id);
            f.addProperty("reason", reason);
            arr.add(f);
        });
        body.add("failed", arr);
        postJson("/command-bridge/fail", body);
    }

    // ---------------------------------------------------------------------
    // Executor task queue
    // ---------------------------------------------------------------------

    /** One queued executor task targeted at this server. */
    public static final class ExecutorTask {
        public final long id;
        public final String command;

        ExecutorTask(long id, String command) {
            this.id = id;
            this.command = command;
        }
    }

    /** Fetch + claim (pending -> processing) up to {@code limit} tasks for this server. */
    public List<ExecutorTask> pollExecutorTasks(int limit) throws Exception {
        String url = apiUrl() + "/bridge/processor/get?status=pending&claim=true&limit=" + limit
                + "&slug=" + URLEncoder.encode(serverName(), StandardCharsets.UTF_8);

        Response res = Request.builder()
                .setURL(url)
                .setMethod(Request.Method.GET)
                .addHeader("x-access-token", apiKey())
                .build()
                .execute();

        JsonObject json = parse("GET /bridge/processor/get", res);

        List<ExecutorTask> out = new ArrayList<>();
        if (isSuccess(json) && json.has("data") && json.get("data").isJsonArray()) {
            for (JsonElement el : json.getAsJsonArray("data")) {
                JsonObject t = el.getAsJsonObject();
                out.add(new ExecutorTask(
                        t.get("executorTaskId").getAsLong(),
                        t.get("command").getAsString()));
            }
        }
        return out;
    }

    public void reportExecutorTask(long taskId, String status, String result) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("status", status);
        if (result != null && !result.isEmpty()) body.addProperty("result", result);
        body.addProperty("executedBy", "zander-addon:" + serverName());
        postJson("/bridge/processor/task/" + taskId + "/report", body);
    }

    // ---------------------------------------------------------------------

    private JsonObject postJson(String path, JsonObject body) throws Exception {
        Response res = Request.builder()
                .setURL(apiUrl() + path)
                .setMethod(Request.Method.POST)
                .addHeader("x-access-token", apiKey())
                .addHeader("Content-Type", "application/json")
                .setRequestBody(body.toString())
                .build()
                .execute();
        return parse("POST " + path, res);
    }

    private JsonObject parse(String label, Response res) {
        if (res.getStatusCode() != 200) {
            throw new RuntimeException(label + " -> HTTP " + res.getStatusCode() + ": " + res.getBody());
        }
        JsonObject json = gson.fromJson(res.getBody(), JsonObject.class);
        if (json != null && json.has("success") && !json.get("success").getAsBoolean()) {
            String msg = json.has("message") ? json.get("message").getAsString() : "(no message)";
            throw new RuntimeException(label + " -> " + msg);
        }
        return json;
    }

    private static boolean isSuccess(JsonObject json) {
        return json != null && json.has("success") && json.get("success").getAsBoolean();
    }
}
