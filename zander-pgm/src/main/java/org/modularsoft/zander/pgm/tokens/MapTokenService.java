package org.modularsoft.zander.pgm.tokens;

import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.modularsoft.zander.pgm.api.ZanderApiClient;
import org.modularsoft.zander.pgm.api.ZanderWebSocketClient;
import org.modularsoft.zander.pgm.api.dto.MapTokenRequestEventDto;
import org.modularsoft.zander.pgm.api.dto.MapTokensBalanceEventDto;
import org.modularsoft.zander.pgm.config.ZanderPGMConfig;
import org.modularsoft.zander.pgm.pgm.MapRotationService;
import org.modularsoft.zander.pgm.util.AsyncUtil;
import org.modularsoft.zander.pgm.util.SafeLogger;
import org.modularsoft.zander.pgm.util.TimeUtil;
import org.modularsoft.zander.pgm.voting.MapVoteService;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Handles local Map Token balances plus remote token-request application.
 * Balances are persisted locally so admin and console commands continue to work
 * even while zander-web is offline.
 */
public class MapTokenService {

    private final Plugin plugin;
    private final ZanderPGMConfig config;
    private final ZanderApiClient api;
    private final ZanderWebSocketClient ws;
    private final MapRotationService rotation;
    private final MapVoteService voteService;
    private final SafeLogger logger;
    private final MapTokenStorage storage;

    private final Map<String, Long> playerCooldowns = new ConcurrentHashMap<>();
    private final Map<String, Integer> mapCooldowns = new ConcurrentHashMap<>();

    public MapTokenService(Plugin plugin, ZanderPGMConfig config, ZanderApiClient api,
                           ZanderWebSocketClient ws, MapRotationService rotation,
                           MapVoteService voteService, SafeLogger logger) {
        this(plugin, config, api, ws, rotation, voteService, logger,
                new MapTokenStorage(plugin.getDataFolder().toPath()
                        .resolve("map-tokens")
                        .resolve("map-tokens.json")));
    }

    MapTokenService(Plugin plugin, ZanderPGMConfig config, ZanderApiClient api,
                    ZanderWebSocketClient ws, MapRotationService rotation,
                    MapVoteService voteService, SafeLogger logger, MapTokenStorage storage) {
        this.plugin = plugin;
        this.config = config;
        this.api = api;
        this.ws = ws;
        this.rotation = rotation;
        this.voteService = voteService;
        this.logger = logger;
        this.storage = storage;
        loadStorage();
    }

    private void loadStorage() {
        try {
            storage.load();
        } catch (Exception e) {
            logger.error("Failed to load Map Token storage", e);
        }
    }

    /** Process a request end-to-end (validation happens on the main thread). */
    public void handle(MapTokenRequest req) {
        if (!config.mapTokensEnabled || !config.feature("mapTokens")) {
            reject(req, "Map tokens are disabled");
            return;
        }
        emit(req, "MAP_REQUEST_RECEIVED", "RECEIVED", null);

        AsyncUtil.sync(plugin, () -> {
            String failure = validate(req);
            if (failure != null) {
                reject(req, failure);
                return;
            }
            emit(req, "MAP_REQUEST_ACCEPTED", "ACCEPTED", null);
            apply(req);
        });
    }

    public synchronized MapTokenBalance getBalance(UUID playerUuid, String username) {
        try {
            MapTokenBalance balance = storage.getBalance(playerUuid, username);
            if (username != null && !username.isBlank() && !username.equals(balance.username)) {
                balance.username = username;
                storage.saveBalance(balance);
            }
            return balance;
        } catch (Exception e) {
            logger.error("Failed to read Map Token balance", e);
            throw new IllegalStateException("Storage read failure");
        }
    }

    public synchronized MapTokenBalance findStoredBalanceByUsername(String username) {
        try {
            return storage.findByUsername(username);
        } catch (Exception e) {
            logger.error("Failed to search Map Token storage", e);
            throw new IllegalStateException("Storage read failure");
        }
    }

    public synchronized void refreshKnownUsername(UUID playerUuid, String username) {
        try {
            storage.updateUsernameIfPresent(playerUuid, username);
        } catch (Exception e) {
            logger.error("Failed to update known Map Token username", e);
        }
    }

    public synchronized MapTokenBalance grantTokens(UUID playerUuid, String username, int amount,
                                                    String reason, String actor, String source) {
        validatePositive(amount, "Grant");
        return applyBalanceChange(playerUuid, username, MapTokenTransactionType.GRANT, amount,
                defaultReason(reason, "Manual grant"), actor, source, null);
    }

    public synchronized MapTokenBalance removeTokens(UUID playerUuid, String username, int amount,
                                                     String reason, String actor, String source) {
        validatePositive(amount, "Remove");
        MapTokenBalance current = getBalance(playerUuid, username);
        if (current.balance < amount) {
            throw new IllegalStateException(displayName(current, username)
                    + " only has " + current.balance + " Map Tokens. Cannot remove " + amount + ".");
        }
        return applyBalanceChange(playerUuid, username, MapTokenTransactionType.REMOVE, amount,
                defaultReason(reason, "Manual removal"), actor, source, null);
    }

    public synchronized MapTokenBalance setTokens(UUID playerUuid, String username, int amount,
                                                  String reason, String actor, String source) {
        if (amount < 0) {
            throw new IllegalArgumentException("Set amount must be 0 or greater.");
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("mode", "ABSOLUTE");
        return applyAbsoluteSet(playerUuid, username, amount,
                defaultReason(reason, "Manual balance set"), actor, source, metadata);
    }

    public synchronized boolean spendTokens(UUID playerUuid, String username, int amount, String reason,
                                            Map<String, Object> metadata) {
        validatePositive(amount, "Spend");
        MapTokenBalance current = getBalance(playerUuid, username);
        if (current.balance < amount) {
            return false;
        }
        applyBalanceChange(playerUuid, username, MapTokenTransactionType.SPEND, amount,
                defaultReason(reason, "Map Token spend"), "SYSTEM", "SYSTEM", metadata);
        return true;
    }

    public synchronized MapTokenBalance refundTokens(UUID playerUuid, String username, int amount, String reason,
                                                     Map<String, Object> metadata) {
        validatePositive(amount, "Refund");
        return applyBalanceChange(playerUuid, username, MapTokenTransactionType.REFUND, amount,
                defaultReason(reason, "Map Token refund"), "SYSTEM", "SYSTEM", metadata);
    }

    public synchronized List<MapTokenTransaction> getHistory(UUID playerUuid, int page, int pageSize) {
        try {
            return storage.getHistory(playerUuid, page, pageSize);
        } catch (Exception e) {
            logger.error("Failed to read Map Token history", e);
            throw new IllegalStateException("Storage read failure");
        }
    }

    public synchronized int historyCount(UUID playerUuid) {
        try {
            return storage.historyCount(playerUuid);
        } catch (Exception e) {
            logger.error("Failed to count Map Token history", e);
            throw new IllegalStateException("Storage read failure");
        }
    }

    private String validate(MapTokenRequest req) {
        if (req.mapKey == null || req.mapKey.isBlank()) {
            return "No map specified";
        }
        if (!rotation.mapExists(req.mapKey)) {
            return "Map does not exist";
        }
        if (Bukkit.getOnlinePlayers().size() < config.mapTokenMinimumPlayersOnline) {
            return "Not enough players online";
        }
        long now = System.currentTimeMillis();
        Long until = playerCooldowns.get(req.uuid);
        if (until != null && until > now) {
            return "Player cooldown active";
        }
        Integer mapCd = mapCooldowns.get(req.mapKey.toLowerCase());
        if (mapCd != null && mapCd > 0) {
            return "Map cooldown active";
        }
        return null;
    }

    private void apply(MapTokenRequest req) {
        try {
            if (req.isSetNext()) {
                rotation.setNextMapOverride(req.mapKey);
            } else if (req.isSponsor()) {
                voteService.addNomination(req.mapKey, req.mapKey, true);
            } else {
                voteService.addNomination(req.mapKey, req.mapKey, false);
            }
            playerCooldowns.put(req.uuid,
                    System.currentTimeMillis() + config.mapTokenPlayerCooldownMinutes * 60_000L);
            mapCooldowns.put(req.mapKey.toLowerCase(), config.mapTokenMapCooldownMatches);
            emit(req, "MAP_REQUEST_APPLIED", "APPLIED", null);
            Bukkit.broadcastMessage("Â§6[Mixed] Â§e" + req.username + " used a Map Token for Â§f" + req.mapKey);
        } catch (Exception e) {
            fail(req, "Apply error: " + e.getMessage());
        }
    }

    private void reject(MapTokenRequest req, String reason) {
        emit(req, "MAP_REQUEST_REJECTED", "REJECTED", reason);
        maybeRefund(req, reason);
    }

    private void fail(MapTokenRequest req, String reason) {
        emit(req, "MAP_REQUEST_FAILED", "FAILED", reason);
        maybeRefund(req, reason);
    }

    private void maybeRefund(MapTokenRequest req, String reason) {
        if (config.mapTokenRefundIfFailed) {
            emit(req, "MAP_REQUEST_REFUNDED", "REFUNDED", reason);
        }
    }

    private void emit(MapTokenRequest req, String type, String status, String reason) {
        MapTokenRequestEventDto dto = new MapTokenRequestEventDto(type);
        dto.requestId = req.id;
        dto.uuid = req.uuid;
        dto.username = req.username;
        dto.mapKey = req.mapKey;
        dto.action = req.action;
        dto.tokenCost = req.tokenCost;
        dto.status = status;
        dto.reason = reason;
        if (api != null) {
            api.send(dto);
        }
        if (ws != null) {
            ws.send(dto);
        }
        if (req.id != null && api != null) {
            Map<String, Object> result = new HashMap<>();
            result.put("status", status);
            result.put("reason", reason);
            api.mapTokenResult(req.id, result);
        }
    }

    /** Decrement per-map cooldown counters when a match ends. */
    public void tickMatchCooldowns() {
        mapCooldowns.replaceAll((k, v) -> Math.max(0, v - 1));
        mapCooldowns.values().removeIf(v -> v <= 0);
    }

    public int pendingCount() {
        return 0;
    }

    public String status() {
        return "enabled=" + config.mapTokensEnabled
                + ", nextMapOverride=" + rotation.nextMapOverride().orElse("none")
                + ", playerCooldowns=" + playerCooldowns.size()
                + ", mapCooldowns=" + mapCooldowns.size();
    }

    public synchronized boolean clearOverride(String actor, String source) {
        boolean hadOverride = rotation.nextMapOverride().isPresent();
        rotation.clearNextMapOverride();
        if (hadOverride) {
            emitBalanceEvent("MAP_TOKEN_OVERRIDE_CLEARED", null, null, 0, 0, 0,
                    "Pending next-map override cleared", actor, source);
        }
        return hadOverride;
    }

    private MapTokenBalance applyAbsoluteSet(UUID playerUuid, String username, int targetBalance,
                                             String reason, String actor, String source,
                                             Map<String, Object> metadata) {
        MapTokenBalance current = getBalance(playerUuid, username);
        int previousBalance = current.balance;
        int delta = targetBalance - previousBalance;

        current.balance = targetBalance;
        current.username = username;
        if (delta > 0) {
            current.lifetimeEarned += delta;
        } else if (delta < 0) {
            current.lifetimeSpent += Math.abs(delta);
        }

        MapTokenTransaction tx = buildTransaction(playerUuid, username, MapTokenTransactionType.SET, Math.abs(delta),
                previousBalance, targetBalance, reason, actor, source, metadata);
        saveBalanceChange(current, tx);
        emitBalanceEvent("MAP_TOKENS_SET", playerUuid, username, Math.abs(delta),
                previousBalance, targetBalance, reason, actor, source);
        return current.copy();
    }

    private MapTokenBalance applyBalanceChange(UUID playerUuid, String username, MapTokenTransactionType type,
                                               int amount, String reason, String actor, String source,
                                               Map<String, Object> metadata) {
        MapTokenBalance current = getBalance(playerUuid, username);
        int previousBalance = current.balance;
        int newBalance = previousBalance;

        switch (type) {
            case GRANT, REFUND, WEBSTORE -> {
                newBalance = previousBalance + amount;
                current.lifetimeEarned += amount;
            }
            case REMOVE, SPEND -> {
                if (previousBalance < amount) {
                    throw new IllegalStateException(displayName(current, username)
                            + " only has " + previousBalance + " Map Tokens. Cannot remove " + amount + ".");
                }
                newBalance = previousBalance - amount;
                current.lifetimeSpent += amount;
            }
            case ADMIN, SYSTEM -> newBalance = previousBalance;
            case SET -> throw new IllegalStateException("SET must use applyAbsoluteSet");
        }

        current.balance = newBalance;
        current.username = username;

        MapTokenTransaction tx = buildTransaction(playerUuid, username, type, amount, previousBalance, newBalance,
                reason, actor, source, metadata);
        saveBalanceChange(current, tx);
        emitBalanceEvent(eventType(type), playerUuid, username, amount, previousBalance, newBalance,
                reason, actor, source);
        return current.copy();
    }

    private MapTokenTransaction buildTransaction(UUID playerUuid, String username, MapTokenTransactionType type,
                                                 int amount, int previousBalance, int newBalance, String reason,
                                                 String actor, String source, Map<String, Object> metadata) {
        MapTokenTransaction tx = new MapTokenTransaction();
        tx.transactionId = UUID.randomUUID().toString();
        tx.playerUuid = playerUuid.toString();
        tx.username = username;
        tx.type = type;
        tx.amount = amount;
        tx.previousBalance = previousBalance;
        tx.newBalance = newBalance;
        tx.reason = reason;
        tx.actor = actor;
        tx.source = source;
        tx.createdAt = System.currentTimeMillis();
        if (metadata != null) {
            tx.metadata.putAll(metadata);
        }
        if (type == MapTokenTransactionType.SET) {
            tx.metadata.put("targetBalance", newBalance);
        }
        return tx;
    }

    private void saveBalanceChange(MapTokenBalance balance, MapTokenTransaction tx) {
        try {
            storage.saveBalanceAndTransaction(balance, tx);
        } catch (Exception e) {
            logger.error("Failed to persist Map Token change", e);
            throw new IllegalStateException("Storage write failure");
        }
    }

    private void emitBalanceEvent(String type, UUID playerUuid, String username, int amount, int previousBalance,
                                  int newBalance, String reason, String actor, String source) {
        if (api == null && ws == null) {
            return;
        }
        MapTokensBalanceEventDto dto = new MapTokensBalanceEventDto(type);
        dto.playerUuid = playerUuid != null ? playerUuid.toString() : null;
        dto.username = username;
        dto.transactionType = mapTransactionType(type);
        dto.amount = amount;
        dto.previousBalance = previousBalance;
        dto.newBalance = newBalance;
        dto.reason = reason;
        dto.actor = actor;
        dto.source = source;
        dto.createdAt = TimeUtil.isoNow();
        if (api != null) {
            api.send(dto);
        }
        if (ws != null) {
            ws.send(dto);
        }
    }

    private static String mapTransactionType(String eventType) {
        return switch (eventType) {
            case "MAP_TOKENS_GRANTED" -> "GRANT";
            case "MAP_TOKENS_REMOVED" -> "REMOVE";
            case "MAP_TOKENS_SET" -> "SET";
            case "MAP_TOKENS_SPENT" -> "SPEND";
            case "MAP_TOKENS_REFUNDED" -> "REFUND";
            default -> "SYSTEM";
        };
    }

    private static String eventType(MapTokenTransactionType type) {
        return switch (type) {
            case GRANT, WEBSTORE -> "MAP_TOKENS_GRANTED";
            case REMOVE -> "MAP_TOKENS_REMOVED";
            case SET -> "MAP_TOKENS_SET";
            case SPEND -> "MAP_TOKENS_SPENT";
            case REFUND -> "MAP_TOKENS_REFUNDED";
            case ADMIN, SYSTEM -> "MAP_TOKENS_SET";
        };
    }

    private static void validatePositive(int amount, String label) {
        if (amount <= 0) {
            throw new IllegalArgumentException(label + " amount must be greater than 0.");
        }
    }

    private static String defaultReason(String reason, String fallback) {
        return reason == null || reason.isBlank() ? fallback : reason;
    }

    private static String displayName(MapTokenBalance balance, String fallback) {
        if (balance.username != null && !balance.username.isBlank()) {
            return balance.username;
        }
        return fallback != null && !fallback.isBlank() ? fallback : balance.playerUuid;
    }
}
