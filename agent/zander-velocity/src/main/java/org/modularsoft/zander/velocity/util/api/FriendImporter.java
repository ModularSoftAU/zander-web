package org.modularsoft.zander.velocity.util.api;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import org.modularsoft.zander.velocity.ZanderVelocityMain;

import java.io.BufferedWriter;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * One-shot migration of the legacy {@code private-messages.json} into the friends
 * API. Existing ignore lists and "messages disabled" flags are real user data
 * and must survive the switch to a centralised store.
 *
 * <p>Runs once: a {@code .friends-imported} marker file in the plugin data
 * directory guards against re-running (which would also re-hit the API's
 * per-actor rate limits). The JSON file is left in place afterwards — its
 * {@code nameCache} is still used at runtime.</p>
 *
 * <p>The import POSTs carry {@code x-friends-import: 1}, which the API honours
 * (alongside the machine token it already holds) to skip the per-actor rate
 * limits — a bulk migration legitimately exceeds them.</p>
 *
 * <p><b>If a single row still fails to import</b> (unknown target name, or an API
 * rejection) that row is logged to {@code friends-import-failures.log} and
 * skipped; the rest of the import continues and the marker is still written.
 * Nothing is retried automatically — an operator replays the failure log by
 * hand. A player whose row failed simply keeps no block for that pair until
 * then; their DMs are not silently opened, because the messaging path fails
 * closed on unknown state.</p>
 */
public final class FriendImporter {

    private static final String LEGACY_FILE = "private-messages.json";
    private static final String MARKER_FILE = ".friends-imported";
    private static final String FAILURE_LOG = "friends-import-failures.log";

    private FriendImporter() {
    }

    public static void runOnce() {
        Path dir = ZanderVelocityMain.getDataDirectory();
        Path marker = dir.resolve(MARKER_FILE);
        Path legacy = dir.resolve(LEGACY_FILE);

        if (Files.exists(marker)) {
            return;
        }
        if (!Files.exists(legacy)) {
            writeMarker(marker, "no legacy file");
            return;
        }

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            int blocksOk = 0;
            int settingsOk = 0;
            List<String> failures = new ArrayList<>();

            try (Reader reader = Files.newBufferedReader(legacy, StandardCharsets.UTF_8)) {
                JsonElement root = JsonParser.parseReader(reader);
                if (!root.isJsonObject()) {
                    writeMarker(marker, "legacy file not a JSON object");
                    return;
                }
                JsonObject obj = root.getAsJsonObject();
                JsonObject nameCache = obj.has("nameCache") && obj.get("nameCache").isJsonObject()
                        ? obj.getAsJsonObject("nameCache") : new JsonObject();

                String baseUrl = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
                String apiKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

                // --- messagesDisabled -> allowMessagesFrom: "none" ---
                if (obj.has("messagesDisabled") && obj.get("messagesDisabled").isJsonObject()) {
                    for (Map.Entry<String, JsonElement> e : obj.getAsJsonObject("messagesDisabled").entrySet()) {
                        if (!e.getValue().isJsonPrimitive() || !e.getValue().getAsBoolean()) {
                            continue;
                        }
                        JsonObject body = new JsonObject();
                        body.addProperty("uuid", e.getKey());
                        body.addProperty("allowMessagesFrom", "none");
                        if (call(baseUrl + "/settings", apiKey, body)) {
                            settingsOk++;
                        } else {
                            failures.add("settings uuid=" + e.getKey());
                        }
                    }
                }

                // --- ignoreList -> blocks ---
                if (obj.has("ignoreList") && obj.get("ignoreList").isJsonObject()) {
                    for (Map.Entry<String, JsonElement> owner : obj.getAsJsonObject("ignoreList").entrySet()) {
                        if (!owner.getValue().isJsonArray()) {
                            continue;
                        }
                        for (JsonElement targetEl : owner.getValue().getAsJsonArray()) {
                            String targetUuid = targetEl.getAsString();
                            String targetName = nameCache.has(targetUuid) && !nameCache.get(targetUuid).isJsonNull()
                                    ? nameCache.get(targetUuid).getAsString() : null;
                            if (targetName == null) {
                                failures.add("block owner=" + owner.getKey() + " target=" + targetUuid + " (no cached name)");
                                continue;
                            }
                            JsonObject body = new JsonObject();
                            body.addProperty("uuid", owner.getKey());
                            body.addProperty("targetName", targetName);
                            body.addProperty("reason", "Imported from legacy ignore list");
                            if (call(baseUrl + "/blocks/add", apiKey, body)) {
                                blocksOk++;
                            } else {
                                failures.add("block owner=" + owner.getKey() + " target=" + targetName);
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                ZanderVelocityMain.getLogger().error("[friends] importer aborted", ex);
                return; // no marker -> retried next boot
            }

            if (!failures.isEmpty()) {
                writeFailureLog(dir.resolve(FAILURE_LOG), failures);
            }
            ZanderVelocityMain.getLogger().info(
                    "[friends] legacy import complete: {} blocks, {} messagesDisabled, {} failure(s)"
                            + (failures.isEmpty() ? "" : " (see " + FAILURE_LOG + ")"),
                    blocksOk, settingsOk, failures.size());
            writeMarker(marker, blocksOk + " blocks / " + settingsOk + " settings / " + failures.size() + " failed");
        }).schedule();
    }

    private static boolean call(String url, String apiKey, JsonObject body) {
        try {
            Response res = Request.builder()
                    .setURL(url)
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", apiKey)
                    // Bypass the per-actor rate limits: a bulk one-shot migration
                    // legitimately exceeds them and must not drop rows.
                    .addHeader("x-friends-import", "1")
                    .setRequestBody(body.toString())
                    .build()
                    .execute();
            if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
                return false;
            }
            JsonElement el = JsonParser.parseString(res.getBody());
            return el.isJsonObject()
                    && el.getAsJsonObject().has("success")
                    && el.getAsJsonObject().get("success").getAsBoolean();
        } catch (Exception e) {
            return false;
        }
    }

    private static void writeMarker(Path marker, String note) {
        try (BufferedWriter w = Files.newBufferedWriter(marker, StandardCharsets.UTF_8)) {
            w.write("friends legacy import ran " + Instant.now() + " — " + note + "\n");
        } catch (Exception e) {
            ZanderVelocityMain.getLogger().warn("[friends] could not write import marker", e);
        }
    }

    private static void writeFailureLog(Path path, List<String> failures) {
        try (BufferedWriter w = Files.newBufferedWriter(path, StandardCharsets.UTF_8)) {
            w.write("# friends legacy import failures — " + Instant.now() + "\n");
            for (String f : failures) {
                w.write(f + "\n");
            }
        } catch (Exception e) {
            ZanderVelocityMain.getLogger().warn("[friends] could not write import failure log", e);
        }
    }
}
