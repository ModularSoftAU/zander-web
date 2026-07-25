package dev.anchorlight.zander.hub.bridge;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class BridgeClientTest {
    @Test
    void correlatesResponseToItsRequestByRequestId() throws Exception {
        java.util.concurrent.atomic.AtomicReference<byte[]> sent = new java.util.concurrent.atomic.AtomicReference<>();
        BridgeClient client = new BridgeClient((player, bytes) -> sent.set(bytes), 2000L);

        CompletableFuture<BridgeMessage.ServerListResponse> future = client.requestServerList(null);
        BridgeMessage.ServerListRequest decodedRequest =
                (BridgeMessage.ServerListRequest) BridgeCodec.decode(sent.get());

        var response = new BridgeMessage.ServerListResponse(decodedRequest.requestId(),
                List.of(new BridgeMessage.ServerInfo("survival", 3, true, true, false)));
        client.onPluginMessageReceived(BridgeCodec.encode(response));

        BridgeMessage.ServerListResponse result = future.get(1, TimeUnit.SECONDS);
        assertEquals(1, result.servers().size());
        assertEquals("survival", result.servers().get(0).id());
    }

    @Test
    void ignoresResponseWithUnknownRequestId() {
        BridgeClient client = new BridgeClient((player, bytes) -> {
        }, 2000L);
        var response = new BridgeMessage.ServerListResponse("no-such-request", List.of());
        assertDoesNotThrow(() -> client.onPluginMessageReceived(BridgeCodec.encode(response)));
    }

    @Test
    void timesOutWhenNoResponseArrives() {
        BridgeClient client = new BridgeClient((player, bytes) -> {
        }, 50L);
        CompletableFuture<BridgeMessage.ServerListResponse> future = client.requestServerList(null);

        ExecutionException ex = assertThrows(ExecutionException.class, () -> future.get(1, TimeUnit.SECONDS));
        assertInstanceOf(TimeoutException.class, ex.getCause());
    }

    @Test
    void connectRequestResolvesOnConnectStarted() throws Exception {
        java.util.concurrent.atomic.AtomicReference<byte[]> sent = new java.util.concurrent.atomic.AtomicReference<>();
        BridgeClient client = new BridgeClient((player, bytes) -> sent.set(bytes), 2000L);

        CompletableFuture<BridgeMessage> future = client.sendConnectRequest(null, "portal-1", "survival");
        BridgeMessage.ConnectRequest decoded = (BridgeMessage.ConnectRequest) BridgeCodec.decode(sent.get());
        assertEquals("portal-1", decoded.portalId());

        client.onPluginMessageReceived(BridgeCodec.encode(new BridgeMessage.ConnectStarted(decoded.requestId(), "survival")));
        assertInstanceOf(BridgeMessage.ConnectStarted.class, future.get(1, TimeUnit.SECONDS));
    }
}
