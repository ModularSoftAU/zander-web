package org.modularsoft.zander.velocity.util.api;

import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.session.SessionVanish;
import org.modularsoft.zander.velocity.util.messaging.VanishStatusResolver;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Keeps the web app's {@code gameSessions.hidden} flag in step with each online
 * player's live PremiumVanish state, so public presence reads on the website can
 * treat a vanished player exactly like an offline one.
 *
 * <p>The proxy owns no database connection, so this reconciles over the HTTP API.
 * There is no PremiumVanish event on Velocity we can rely on across versions, so
 * this polls: every {@link #INTERVAL_SECONDS}s it diffs each online player's
 * vanish state against the last value it reported and POSTs only the changes.
 * All network calls run off the main thread via the proxy scheduler.</p>
 */
public class VanishReporter {

    private static final long INTERVAL_SECONDS = 10;
    private static final Map<UUID, Boolean> lastReported = new ConcurrentHashMap<>();

    private VanishReporter() {
    }

    public static void startVanishReporterTask() {
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            // If we can't trust vanish state, publish nothing at all.
            if (!VanishStatusResolver.isPresenceSafe()) {
                return;
            }

            for (Player player : ZanderVelocityMain.getProxy().getAllPlayers()) {
                boolean vanished = VanishStatusResolver.isVanished(player);
                Boolean previous = lastReported.get(player.getUniqueId());
                if (previous == null || previous.booleanValue() != vanished) {
                    report(player.getUniqueId(), player.getUsername(), vanished);
                }
            }

            // Drop bookkeeping for players who have since left.
            lastReported.keySet().removeIf(
                    uuid -> ZanderVelocityMain.getProxy().getPlayer(uuid).isEmpty());
        }).repeat(INTERVAL_SECONDS, TimeUnit.SECONDS).schedule();
    }

    /** Forget a player's last-reported state, e.g. on disconnect, so a later login re-reports. */
    public static void forget(UUID uuid) {
        if (uuid != null) {
            lastReported.remove(uuid);
        }
    }

    /**
     * POST the vanish state for one player. Runs the HTTP call on the proxy
     * scheduler so it never touches the main thread.
     */
    public static void report(UUID uuid, String username, boolean hidden) {
        if (uuid == null) {
            return;
        }
        String baseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String apiKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            try {
                SessionVanish payload = SessionVanish.builder()
                        .uuid(uuid)
                        .hidden(hidden)
                        .build();

                Request req = Request.builder()
                        .setURL(baseAPIURL + "/session/vanish")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", apiKey)
                        .setRequestBody(payload.toString())
                        .build();

                Response res = req.execute();
                ZanderVelocityMain.getLogger().info(
                        "Vanish report for " + username + " (hidden=" + hidden + ") -> "
                                + res.getStatusCode() + ": " + res.getBody());

                // Only remember the state once the API has accepted it.
                if (res.getStatusCode() >= 200 && res.getStatusCode() < 300) {
                    lastReported.put(uuid, hidden);
                }
            } catch (Exception e) {
                ZanderVelocityMain.getLogger().error(
                        "Failed to report vanish state for " + username, e);
            }
        }).schedule();
    }
}
