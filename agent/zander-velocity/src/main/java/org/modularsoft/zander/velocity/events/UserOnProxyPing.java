package org.modularsoft.zander.velocity.events;

import com.jayway.jsonpath.JsonPath;
import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyPingEvent;
import com.velocitypowered.api.proxy.server.ServerPing.Builder;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
<<<<<<< HEAD
import org.slf4j.Logger;

import java.util.concurrent.TimeUnit;

public class UserOnProxyPing {

    private static final Logger logger = ZanderVelocityMain.getLogger();

    private final ZanderVelocityMain plugin;
    private volatile Component cachedMotd = null;
=======

public class UserOnProxyPing {

    private final ZanderVelocityMain plugin;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9

    public UserOnProxyPing(ZanderVelocityMain plugin) {
        this.plugin = plugin;
        ZanderVelocityMain.getProxy().getEventManager().register(plugin, this);
<<<<<<< HEAD

        // Fetch MOTD immediately, then refresh every 60 seconds
        ZanderVelocityMain.getProxy().getScheduler()
                .buildTask(plugin, this::refreshMotd)
                .repeat(60, TimeUnit.SECONDS)
                .schedule();
    }

    private void refreshMotd() {
        try {
            String baseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
            String apiKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

=======
    }

    @Subscribe(order = PostOrder.FIRST)
    public void onProxyPingEvent(ProxyPingEvent event) {
        // Get the existing ServerPing.Builder from the event
        Builder pingBuilder = event.getPing().asBuilder();

        try {
            // Fetch configuration values
            String baseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
            String apiKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

            // Make a GET request to fetch the MOTD
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
            Request req = Request.builder()
                    .setURL(baseAPIURL + "/announcement/get?announcementType=motd")
                    .setMethod(Request.Method.GET)
                    .addHeader("x-access-token", apiKey)
                    .build();

            Response res = req.execute();
            String json = res.getBody();

<<<<<<< HEAD
            String colourMessageFormat = JsonPath.read(json, "$.data[0].colourMessageFormat");
            String motdTopLine = ZanderVelocityMain.getConfig().getString(Route.from("announcementMOTDTopLine"));
            cachedMotd = LegacyComponentSerializer.builder()
                    .character('&')
                    .build()
                    .deserialize(motdTopLine + "\n" + colourMessageFormat);
        } catch (Exception e) {
            logger.error("Failed to refresh MOTD from API", e);
        }
    }

    @Subscribe(order = PostOrder.FIRST)
    public void onProxyPingEvent(ProxyPingEvent event) {
        Builder pingBuilder = event.getPing().asBuilder();

        Component motd = cachedMotd;
        if (motd != null) {
            pingBuilder.description(motd);
        } else {
            // Fallback MOTD when cache has not yet been populated
=======
            // Parse and format the MOTD
            String colourMessageFormat = JsonPath.read(json, "$.data[0].colourMessageFormat");
            String motdTopLine = ZanderVelocityMain.getConfig().getString(Route.from("announcementMOTDTopLine"));
            Component serverPingDescription = LegacyComponentSerializer.builder()
                    .character('&')
                    .build()
                    .deserialize(motdTopLine + "\n" + colourMessageFormat);

            // Set the description in the ServerPing.Builder
            pingBuilder.description(serverPingDescription);

        } catch (Exception e) {
            System.out.print(e);

            // Fallback MOTD in case of an exception
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
            String motdTopLine = ZanderVelocityMain.getConfig().getString(Route.from("announcementMOTDTopLine"));
            Component fallbackDescription = LegacyComponentSerializer.builder()
                    .character('&')
                    .build()
                    .deserialize(motdTopLine + "\n" + "&3&lPowered by Zander");
<<<<<<< HEAD
            pingBuilder.description(fallbackDescription);
        }

        event.setPing(pingBuilder.build());
    }
}
=======

            pingBuilder.description(fallbackDescription);
        }

        // Set the modified ServerPing back to the event
        event.setPing(pingBuilder.build());
    }
}
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
