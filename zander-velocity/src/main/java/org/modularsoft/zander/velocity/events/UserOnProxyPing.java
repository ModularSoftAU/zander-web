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

public class UserOnProxyPing {

    private final ZanderVelocityMain plugin;

    public UserOnProxyPing(ZanderVelocityMain plugin) {
        this.plugin = plugin;
        ZanderVelocityMain.getProxy().getEventManager().register(plugin, this);
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
            Request req = Request.builder()
                    .setURL(baseAPIURL + "/announcement/get?announcementType=motd")
                    .setMethod(Request.Method.GET)
                    .addHeader("x-access-token", apiKey)
                    .build();

            Response res = req.execute();
            String json = res.getBody();

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
            String motdTopLine = ZanderVelocityMain.getConfig().getString(Route.from("announcementMOTDTopLine"));
            Component fallbackDescription = LegacyComponentSerializer.builder()
                    .character('&')
                    .build()
                    .deserialize(motdTopLine + "\n" + "&3&lPowered by Zander");

            pingBuilder.description(fallbackDescription);
        }

        // Set the modified ServerPing back to the event
        event.setPing(pingBuilder.build());
    }
}