package dev.anchorlight.zander.addon.report;

import com.google.common.io.ByteArrayDataOutput;
import com.google.common.io.ByteStreams;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.anchorlight.zander.addon.ZanderAddonMain;
import dev.dejvokep.boostedyaml.route.Route;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Submits player reports to the existing external report API (same endpoint/contract as the
 * report command that previously lived in zander-velocity) and relays a notification to the
 * proxy so staff across the whole network hear about it, not just staff on this one backend
 * server. Follows the same {@code HttpClient}/{@code api-url}/{@code api-key} pattern already
 * used by {@link dev.anchorlight.zander.addon.service.StoreCommandService} and
 * {@link dev.anchorlight.zander.addon.service.BridgeService}.
 */
public class ReportService {

    /**
     * Dedicated namespaced plugin-messaging channel to zander-velocity, carrying reporter,
     * reported-player, and reason as three UTF strings. Must be registered as an outgoing
     * channel in {@code ZanderAddonMain#onEnable()} and as an incoming channel on the Velocity
     * side before this will actually reach the proxy.
     */
    public static final String RELAY_CHANNEL = "zander:report";

    public record SubmitResult(boolean success, String message) {}

    private final ZanderAddonMain plugin;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final Gson gson = new Gson();

    public ReportService(ZanderAddonMain plugin) {
        this.plugin = plugin;
    }

    /**
     * Submits a report and invokes {@code callback} on the main thread with the result.
     * On success, also relays the report to the proxy so {@code zander.report.notify} holders
     * on every backend server are told, not just this one.
     */
    public void submit(Player reporter, String reportedUsername, String reason, Consumer<SubmitResult> callback) {
        String reporterName = reporter.getName();
        CompletableFuture.supplyAsync(() -> doSubmit(reporterName, reportedUsername, reason))
                .whenComplete((result, throwable) -> Bukkit.getScheduler().runTask(plugin, () -> {
                    SubmitResult safeResult = throwable != null
                            ? new SubmitResult(false, "An error has occurred. Is the API down?")
                            : result;
                    if (safeResult.success() && reporter.isOnline()) {
                        relayToProxy(reporter, reportedUsername, reason);
                    }
                    callback.accept(safeResult);
                }));
    }

    private SubmitResult doSubmit(String reporterName, String reportedUsername, String reason) {
        try {
            JsonObject body = new JsonObject();
            body.addProperty("reportPlatform", "INGAME");
            body.addProperty("reportedUser", reportedUsername);
            body.addProperty("reporterUser", reporterName);
            body.addProperty("reportReason", reason);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiBase() + "/report/create"))
                    .header("Content-Type", "application/json")
                    .header("x-access-token", token())
                    .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            boolean success = json.has("success") && json.get("success").getAsBoolean();
            String message = json.has("message") && !json.get("message").isJsonNull()
                    ? json.get("message").getAsString()
                    : (success ? "Report submitted." : "Report could not be submitted.");
            return new SubmitResult(success, message);
        } catch (Exception e) {
            plugin.getLogger().warning("[Report] Submit failed for " + reporterName + ": " + e.getMessage());
            return new SubmitResult(false, "An error has occurred. Is the API down?");
        }
    }

    private void relayToProxy(Player reporter, String reportedUsername, String reason) {
        try {
            ByteArrayDataOutput out = ByteStreams.newDataOutput();
            out.writeUTF(reporter.getName());
            out.writeUTF(reportedUsername);
            out.writeUTF(reason);
            reporter.sendPluginMessage(plugin, RELAY_CHANNEL, out.toByteArray());
        } catch (Exception e) {
            plugin.getLogger().warning("[Report] Failed to relay report to the proxy: " + e.getMessage());
        }
    }

    private String apiBase() {
        String url = plugin.getYamlConfig().getString(Route.from("api-url"), "");
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private String token() {
        return plugin.getYamlConfig().getString(Route.from("api-key"), "");
    }
}
