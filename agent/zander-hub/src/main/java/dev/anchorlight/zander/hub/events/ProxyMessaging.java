package dev.anchorlight.zander.hub.events;

import com.google.common.io.ByteArrayDataOutput;
import com.google.common.io.ByteStreams;
import org.bukkit.entity.Player;
import org.bukkit.plugin.messaging.PluginMessageListener;
import dev.anchorlight.zander.hub.ZanderHubMain;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Sends and resolves BungeeCord-protocol proxy queries (GetServers, PlayerCount)
 * over the "BungeeCord" plugin messaging channel, shared by both Velocity and BungeeCord proxies.
 */
public class ProxyMessaging implements PluginMessageListener {
    private static final long TIMEOUT_SECONDS = 3;
    private static final String CHANNEL = "BungeeCord";

    private final Map<UUID, CompletableFuture<List<String>>> pendingServerList = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<Integer>> pendingPlayerCount = new ConcurrentHashMap<>();

    private static String playerCountKey(UUID playerId, String serverId) {
        return playerId + ":" + serverId;
    }

    /// Request the list of server ids currently registered on the proxy.
    /// Resolves exceptionally with TimeoutException if the proxy doesn't respond within 3 seconds.
    public CompletableFuture<List<String>> requestServerList(Player requester) {
        CompletableFuture<List<String>> future = new CompletableFuture<>();
        pendingServerList.put(requester.getUniqueId(), future);

        ByteArrayDataOutput output = ByteStreams.newDataOutput();
        output.writeUTF("GetServers");
        requester.sendPluginMessage(ZanderHubMain.plugin, CHANNEL, output.toByteArray());

        return future.orTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .whenComplete((result, error) -> pendingServerList.remove(requester.getUniqueId()));
    }

    /// Request the live player count for a specific server id.
    /// Resolves exceptionally with TimeoutException if the proxy doesn't respond within 3 seconds.
    public CompletableFuture<Integer> requestPlayerCount(Player requester, String serverId) {
        String key = playerCountKey(requester.getUniqueId(), serverId);
        CompletableFuture<Integer> future = new CompletableFuture<>();
        pendingPlayerCount.put(key, future);

        ByteArrayDataOutput output = ByteStreams.newDataOutput();
        output.writeUTF("PlayerCount");
        output.writeUTF(serverId);
        requester.sendPluginMessage(ZanderHubMain.plugin, CHANNEL, output.toByteArray());

        return future.orTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .whenComplete((result, error) -> pendingPlayerCount.remove(key));
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!channel.equals(CHANNEL)) {
            return;
        }

        try {
            DataInputStream input = new DataInputStream(new ByteArrayInputStream(message));
            String subchannel = input.readUTF();

            if (subchannel.equals("GetServers")) {
                String serverCsv = input.readUTF();
                List<String> servers = Arrays.asList(serverCsv.split(", ?"));
                CompletableFuture<List<String>> future = pendingServerList.get(player.getUniqueId());
                if (future != null) {
                    future.complete(servers);
                }
            } else if (subchannel.equals("PlayerCount")) {
                String serverId = input.readUTF();
                int count = input.readInt();
                CompletableFuture<Integer> future = pendingPlayerCount.get(playerCountKey(player.getUniqueId(), serverId));
                if (future != null) {
                    future.complete(count);
                }
            }
        } catch (IOException e) {
            ZanderHubMain.plugin.getLogger().warning("Failed to parse BungeeCord plugin message: " + e.getMessage());
        }
    }
}
