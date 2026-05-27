package org.modularsoft.zander.addon.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;
import org.modularsoft.zander.addon.ZanderAddonMain;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

public class StoreCommandService {

    private record PendingCommand(int id, String command, String executeAs) {}

    private record RetryEntry(String playerUuid, PendingCommand command, int attempts, long nextRetryAt) {}

    private static final int MAX_RETRY_ATTEMPTS = 5;

    private final ZanderAddonMain plugin;
    private final Gson gson = new Gson();
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final Queue<RetryEntry> retryQueue = new ConcurrentLinkedQueue<>();
    private final Set<Integer> queuedCommandIds = ConcurrentHashMap.newKeySet();

    public StoreCommandService(ZanderAddonMain plugin) {
        this.plugin = plugin;
    }

    public void start() {
        int pollSeconds = plugin.getConfig().getInt("store-commands.poll-interval-seconds", 300);
        long pollTicks = pollSeconds * 20L;

        new BukkitRunnable() {
            @Override
            public void run() {
                processRetryQueue();
                String serverName = plugin.getConfig().getString("store-commands.server-name", "survival");
                for (Player player : Bukkit.getOnlinePlayers()) {
                    claimAndExecuteCommands(player.getUniqueId().toString(), player.getName(), serverName);
                }
            }
        }.runTaskTimerAsynchronously(plugin, pollTicks, pollTicks);
    }

    public void onPlayerJoin(String playerUuid, String playerName) {
        // Flush any locally-queued retries for this player immediately
        processRetryQueueForPlayer(playerUuid);
        // Claim any new pending commands from the server
        String serverName = plugin.getConfig().getString("store-commands.server-name", "survival");
        claimAndExecuteCommands(playerUuid, playerName, serverName);
    }

    private void claimAndExecuteCommands(String playerUuid, String playerName, String serverName) {
        CompletableFuture.runAsync(() -> {
            try {
                List<PendingCommand> commands = claimCommands(playerUuid, playerName, serverName);
                if (!commands.isEmpty()) {
                    dispatchCommands(playerUuid, commands);
                }
            } catch (Exception e) {
                plugin.getLogger().severe("Error claiming store commands for " + playerName + ": " + e.getMessage());
            }
        });
    }

    private List<PendingCommand> claimCommands(String playerUuid, String playerName, String serverName) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("playerUuid", playerUuid);
        body.addProperty("playerName", playerName);
        body.addProperty("serverName", serverName);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(siteUrl() + "/command-bridge/claim"))
                .header("Content-Type", "application/json")
                .header("x-access-token", apiKey())
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)))
                .build();

        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() != 200) {
            plugin.getLogger().warning("Claim returned HTTP " + res.statusCode() + " for " + playerName);
            return Collections.emptyList();
        }

        JsonObject json = JsonParser.parseString(res.body()).getAsJsonObject();
        if (!json.get("success").getAsBoolean()) return Collections.emptyList();

        JsonArray arr = json.getAsJsonArray("commands");
        List<PendingCommand> commands = new ArrayList<>();
        for (var element : arr) {
            JsonObject cmd = element.getAsJsonObject();
            int id = cmd.get("id").getAsInt();
            if (queuedCommandIds.contains(id)) continue; // already in local retry queue
            String command = cmd.get("command").getAsString();
            String executeAs = cmd.has("executeAs") ? cmd.get("executeAs").getAsString() : "console";
            commands.add(new PendingCommand(id, command, executeAs));
        }
        return commands;
    }

    private void dispatchCommands(String playerUuid, List<PendingCommand> commands) {
        Bukkit.getScheduler().runTask(plugin, () -> {
            List<Integer> successIds = new ArrayList<>();
            List<PendingCommand> failures = new ArrayList<>();

            for (PendingCommand cmd : commands) {
                if (executeCommand(cmd, playerUuid)) {
                    successIds.add(cmd.id());
                } else {
                    failures.add(cmd);
                }
            }

            CompletableFuture.runAsync(() -> {
                if (!successIds.isEmpty()) reportCompleted(playerUuid, successIds);
                for (PendingCommand failed : failures) {
                    reportFailed(playerUuid, failed.id(), "Command dispatch failed");
                    scheduleRetry(playerUuid, failed, 1);
                }
            });
        });
    }

    private void processRetryQueueForPlayer(String playerUuid) {
        List<RetryEntry> playerEntries = new ArrayList<>();
        retryQueue.removeIf(entry -> {
            if (entry.playerUuid().equals(playerUuid)) {
                playerEntries.add(entry);
                return true;
            }
            return false;
        });

        if (playerEntries.isEmpty()) return;

        Bukkit.getScheduler().runTask(plugin, () -> {
            List<Integer> successIds = new ArrayList<>();
            List<RetryEntry> failures = new ArrayList<>();

            for (RetryEntry retry : playerEntries) {
                if (executeCommand(retry.command(), playerUuid)) {
                    successIds.add(retry.command().id());
                    queuedCommandIds.remove(retry.command().id());
                } else {
                    failures.add(retry);
                }
            }

            CompletableFuture.runAsync(() -> {
                if (!successIds.isEmpty()) reportCompleted(playerUuid, successIds);
                for (RetryEntry failure : failures) {
                    reportFailed(playerUuid, failure.command().id(), "Retry on join failed");
                    scheduleRetry(playerUuid, failure.command(), failure.attempts() + 1);
                }
            });
        });
    }

    private void processRetryQueue() {
        long now = System.currentTimeMillis();
        List<RetryEntry> due = new ArrayList<>();
        retryQueue.removeIf(entry -> {
            if (entry.nextRetryAt() <= now) {
                due.add(entry);
                return true;
            }
            return false;
        });

        if (due.isEmpty()) return;

        Map<String, List<RetryEntry>> byPlayer = due.stream()
                .collect(Collectors.groupingBy(RetryEntry::playerUuid));

        Bukkit.getScheduler().runTask(plugin, () -> {
            for (Map.Entry<String, List<RetryEntry>> entry : byPlayer.entrySet()) {
                String playerUuid = entry.getKey();
                List<Integer> successIds = new ArrayList<>();
                List<RetryEntry> failures = new ArrayList<>();

                for (RetryEntry retry : entry.getValue()) {
                    PendingCommand cmd = retry.command();
                    // Defer player-executed commands if the player is offline
                    if (!"console".equalsIgnoreCase(cmd.executeAs())) {
                        Player player = Bukkit.getPlayer(UUID.fromString(playerUuid));
                        if (player == null || !player.isOnline()) {
                            // Re-queue with a fresh delay; will be picked up on next join or poll
                            retryQueue.add(new RetryEntry(playerUuid, cmd, retry.attempts(),
                                    System.currentTimeMillis() + retryDelayMs(retry.attempts())));
                            continue;
                        }
                    }

                    if (executeCommand(cmd, playerUuid)) {
                        successIds.add(cmd.id());
                        queuedCommandIds.remove(cmd.id());
                    } else {
                        failures.add(retry);
                    }
                }

                CompletableFuture.runAsync(() -> {
                    if (!successIds.isEmpty()) reportCompleted(playerUuid, successIds);
                    for (RetryEntry failure : failures) {
                        reportFailed(playerUuid, failure.command().id(),
                                "Retry " + failure.attempts() + " failed");
                        scheduleRetry(playerUuid, failure.command(), failure.attempts() + 1);
                    }
                });
            }
        });
    }

    private boolean executeCommand(PendingCommand cmd, String playerUuid) {
        try {
            if ("console".equalsIgnoreCase(cmd.executeAs())) {
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd.command());
                return true;
            } else {
                Player player = Bukkit.getPlayer(UUID.fromString(playerUuid));
                if (player == null || !player.isOnline()) return false;
                Bukkit.dispatchCommand(player, cmd.command());
                return true;
            }
        } catch (Exception e) {
            plugin.getLogger().warning("Exception dispatching command '" + cmd.command() + "': " + e.getMessage());
            return false;
        }
    }

    private void scheduleRetry(String playerUuid, PendingCommand cmd, int attempts) {
        int maxAttempts = plugin.getConfig().getInt("store-commands.max-retry-attempts", MAX_RETRY_ATTEMPTS);
        if (attempts > maxAttempts) {
            plugin.getLogger().warning("Max retry attempts reached for command " + cmd.id() + ", giving up.");
            queuedCommandIds.remove(cmd.id());
            return;
        }
        long delayMs = retryDelayMs(attempts);
        queuedCommandIds.add(cmd.id());
        retryQueue.add(new RetryEntry(playerUuid, cmd, attempts, System.currentTimeMillis() + delayMs));
        plugin.getLogger().info("Queued retry " + attempts + "/" + maxAttempts
                + " for command " + cmd.id() + " in " + (delayMs / 1000) + "s");
    }

    private long retryDelayMs(int attempts) {
        // Exponential backoff: 30s, 60s, 2m, 4m, 8m
        return Math.min(30_000L * (1L << (attempts - 1)), 8 * 60_000L);
    }

    private void reportCompleted(String playerUuid, List<Integer> ids) {
        try {
            JsonObject body = new JsonObject();
            body.addProperty("playerUuid", playerUuid);
            JsonArray arr = new JsonArray();
            ids.forEach(arr::add);
            body.add("completedCommandIds", arr);
            post(siteUrl() + "/command-bridge/complete", body);
        } catch (Exception e) {
            plugin.getLogger().severe("Error reporting completed commands: " + e.getMessage());
        }
    }

    private void reportFailed(String playerUuid, int commandId, String reason) {
        try {
            JsonObject body = new JsonObject();
            body.addProperty("playerUuid", playerUuid);
            JsonArray failed = new JsonArray();
            JsonObject entry = new JsonObject();
            entry.addProperty("id", commandId);
            entry.addProperty("reason", reason);
            failed.add(entry);
            body.add("failed", failed);
            post(siteUrl() + "/command-bridge/fail", body);
        } catch (Exception e) {
            plugin.getLogger().severe("Error reporting failed command " + commandId + ": " + e.getMessage());
        }
    }

    private void post(String url, JsonObject body) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("x-access-token", apiKey())
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            plugin.getLogger().warning("POST " + url + " returned HTTP " + res.statusCode());
        }
    }

    private String siteUrl() {
        String apiUrl = plugin.getConfig().getString("api-url", "");
        return apiUrl.endsWith("/api") ? apiUrl.substring(0, apiUrl.length() - 4) : apiUrl;
    }

    private String apiKey() {
        return plugin.getConfig().getString("api-key", "");
    }
}
