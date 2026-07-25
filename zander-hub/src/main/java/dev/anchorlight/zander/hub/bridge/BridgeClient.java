package dev.anchorlight.zander.hub.bridge;

import org.bukkit.entity.Player;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Sends {@code zander:hub} bridge requests and resolves the matching response by
 * request id. Replaces the legacy BungeeCord-channel {@code ProxyMessaging}/
 * {@code PluginMessageChannel} pair.
 */
public class BridgeClient {
    @FunctionalInterface
    public interface Sender {
        void send(Player player, byte[] bytes);
    }

    private final Sender sender;
    private final long timeoutMs;
    private final Map<String, CompletableFuture<BridgeMessage>> pending = new ConcurrentHashMap<>();

    public BridgeClient(Sender sender, long timeoutMs) {
        this.sender = sender;
        this.timeoutMs = timeoutMs;
    }

    private String newRequestId() {
        return UUID.randomUUID().toString();
    }

    @SuppressWarnings("unchecked")
    private <T extends BridgeMessage> CompletableFuture<T> send(Player player, BridgeMessage request) {
        String requestId = request.requestId();
        CompletableFuture<BridgeMessage> future = new CompletableFuture<>();
        pending.put(requestId, future);
        sender.send(player, BridgeCodec.encode(request));
        return (CompletableFuture<T>) future
                .orTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .whenComplete((result, error) -> pending.remove(requestId));
    }

    public CompletableFuture<BridgeMessage.ServerListResponse> requestServerList(Player player) {
        return send(player, new BridgeMessage.ServerListRequest(newRequestId()));
    }

    public CompletableFuture<BridgeMessage.PlayerCurrentServerResponse> requestPlayerCurrentServer(Player player) {
        return send(player, new BridgeMessage.PlayerCurrentServerRequest(newRequestId()));
    }

    /** Resolves with whichever of ConnectStarted/ConnectDenied/ConnectFailed the proxy replies with. */
    public CompletableFuture<BridgeMessage> sendConnectRequest(Player player, String portalId, String serverId) {
        return send(player, new BridgeMessage.ConnectRequest(newRequestId(), portalId, serverId));
    }

    /** Feed a raw plugin-message payload received on the {@code zander:hub} channel. */
    public void onPluginMessageReceived(byte[] bytes) {
        BridgeMessage message;
        try {
            message = BridgeCodec.decode(bytes);
        } catch (BridgeProtocolException e) {
            return; // malformed inbound message from the proxy; nothing safe to correlate
        }
        CompletableFuture<BridgeMessage> future = pending.get(message.requestId());
        if (future != null) {
            future.complete(message);
        }
    }
}
