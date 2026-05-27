package org.modularsoft.zander.addon.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitRunnable;
import org.modularsoft.zander.addon.ZanderAddonMain;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class BridgeService {

    private record BridgeTask(int executorTaskId, String command) {}

    private static final int REPORT_MAX_ATTEMPTS = 3;
    private static final long REPORT_RETRY_DELAY_MS = 2_000;

    private final ZanderAddonMain plugin;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final Gson gson = new Gson();

    public BridgeService(ZanderAddonMain plugin) {
        this.plugin = plugin;
    }

    public void start() {
        long pollMs = plugin.getConfig().getLong("bridge.poll-interval-ms", 5000);
        long pollTicks = Math.max(1L, pollMs / 50);

        new BukkitRunnable() {
            @Override
            public void run() {
                pollAndExecute();
            }
        }.runTaskTimerAsynchronously(plugin, pollTicks, pollTicks);
    }

    private void pollAndExecute() {
        List<BridgeTask> tasks;
        try {
            tasks = pollTasks();
        } catch (Exception e) {
            plugin.getLogger().warning("[Bridge] Poll error: " + e.getMessage());
            return;
        }

        if (tasks.isEmpty()) return;

        // Execute all claimed tasks sequentially on the main thread, then report each result async.
        Bukkit.getScheduler().runTask(plugin, () -> {
            for (BridgeTask task : tasks) {
                String status;
                String result;
                try {
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), task.command());
                    status = "completed";
                    result = "Command dispatched successfully";
                } catch (Exception e) {
                    status = "failed";
                    result = e.getMessage() != null ? e.getMessage() : "Unknown error";
                    plugin.getLogger().warning("[Bridge] Task " + task.executorTaskId() + " dispatch failed: " + result);
                }

                final String finalStatus = status;
                final String finalResult = result;
                CompletableFuture.runAsync(() -> reportTask(task.executorTaskId(), finalStatus, finalResult));
            }
        });
    }

    private List<BridgeTask> pollTasks() throws Exception {
        String url = bridgeUrl() + "/bridge/processor/get"
                + "?status=pending&claim=true&slug=" + serverSlug() + "&limit=50";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("x-access-token", bridgeToken())
                .GET()
                .build();

        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() != 200) {
            plugin.getLogger().warning("[Bridge] Poll returned HTTP " + res.statusCode());
            return Collections.emptyList();
        }

        JsonObject json = JsonParser.parseString(res.body()).getAsJsonObject();
        if (!json.get("success").getAsBoolean()) {
            String msg = json.has("message") ? json.get("message").getAsString() : "no message";
            plugin.getLogger().warning("[Bridge] Poll rejected: " + msg);
            return Collections.emptyList();
        }

        JsonArray data = json.getAsJsonArray("data");
        List<BridgeTask> tasks = new ArrayList<>(data.size());
        for (var element : data) {
            JsonObject obj = element.getAsJsonObject();
            tasks.add(new BridgeTask(
                    obj.get("executorTaskId").getAsInt(),
                    obj.get("command").getAsString()
            ));
        }
        return tasks;
    }

    private void reportTask(int taskId, String status, String result) {
        String url = bridgeUrl() + "/bridge/processor/task/" + taskId + "/report";

        JsonObject body = new JsonObject();
        body.addProperty("status", status);
        body.addProperty("result", result);
        body.addProperty("executedBy", serverSlug());
        String bodyJson = gson.toJson(body);

        for (int attempt = 1; attempt <= REPORT_MAX_ATTEMPTS; attempt++) {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .header("x-access-token", bridgeToken())
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                        .build();

                HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 200) return;

                plugin.getLogger().warning("[Bridge] Report for task " + taskId
                        + " returned HTTP " + res.statusCode() + " (attempt " + attempt + ")");
            } catch (Exception e) {
                plugin.getLogger().warning("[Bridge] Report for task " + taskId
                        + " failed (attempt " + attempt + "): " + e.getMessage());
            }

            if (attempt < REPORT_MAX_ATTEMPTS) {
                try {
                    Thread.sleep(REPORT_RETRY_DELAY_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        plugin.getLogger().severe("[Bridge] Gave up reporting task " + taskId
                + " after " + REPORT_MAX_ATTEMPTS + " attempts.");
    }

    private String bridgeUrl() {
        return plugin.getConfig().getString("api-url", "");
    }

    private String bridgeToken() {
        return plugin.getConfig().getString("api-key", "");
    }

    private String serverSlug() {
        return plugin.getConfig().getString("bridge.server-slug", "survival");
    }
}
