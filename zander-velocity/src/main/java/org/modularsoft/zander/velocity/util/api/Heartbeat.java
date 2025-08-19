package org.modularsoft.zander.velocity.util.api;

import com.jayway.jsonpath.JsonPath;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class Heartbeat {
    public static void startHeartbeatTask() {
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

        // Create a ScheduledExecutorService with a single thread
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        // Schedule the task to run every 60 seconds
        scheduler.scheduleAtFixedRate(() -> {
            try {
                // Your existing code here
                // GET request to link to rules.
                Request req = Request.builder()
                        .setURL(BaseAPIURL + "/heartbeat")
                        .setMethod(Request.Method.GET)
                        .addHeader("x-access-token", APIKey)
                        .build();

                Response res = req.execute();
                String json = res.getBody();
                Boolean heartbeat = JsonPath.read(json, "$.success");
                System.out.println("API Heartbeat Success");

                // Check if the heartbeat is not successful
                if (!heartbeat) {
                    // Kick all players
                    ZanderVelocityMain.getProxy().getAllPlayers().forEach(player -> {
                        Component message = Component.text("API Heartbeat Failed, the server is temporarily offline.")
                                .color(NamedTextColor.RED);
                        player.disconnect(message);
                    });
                }
            } catch (Exception e) {
                // Handle exceptions here
                e.printStackTrace();
                ZanderVelocityMain.getLogger().error("API Heartbeat Failed, kicking all players until back online.");

                // Kick all players
                ZanderVelocityMain.getProxy().getAllPlayers().forEach(player -> {
                    Component message = Component.text("API Heartbeat Failed, the server is temporarily offline.")
                            .color(NamedTextColor.RED);
                    player.disconnect(message);
                });
            }
        }, 0, 60, TimeUnit.SECONDS);
    }
}
