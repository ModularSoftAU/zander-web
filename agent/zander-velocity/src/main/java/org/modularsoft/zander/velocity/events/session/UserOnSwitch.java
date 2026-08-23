package org.modularsoft.zander.velocity.events.session;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.ServerConnectedEvent;
import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
<<<<<<< HEAD
=======
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.discord.DiscordSwitch;
import org.modularsoft.zander.velocity.model.session.SessionSwitch;
import org.slf4j.Logger;

import java.util.UUID;

public class UserOnSwitch {
    private static final Logger logger = ZanderVelocityMain.getLogger();

    @Subscribe
    public void onServerConnect(ServerConnectedEvent event) {
        Player player = event.getPlayer();
        String username = player.getUsername();
        UUID playerUUID = player.getUniqueId();
        String server = event.getServer().getServerInfo().getName();
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

        logger.info("Player {} is switching to server {}", username, server);

<<<<<<< HEAD
        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            // Handle Session Switch API
            try {
                SessionSwitch switchSession = SessionSwitch.builder()
                        .uuid(playerUUID)
                        .server(server)
                        .build();

                Request switchSessionReq = Request.builder()
                        .setURL(BaseAPIURL + "/session/switch")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", APIKey)
                        .setRequestBody(switchSession.toString())
                        .build();

                Response switchSessionRes = switchSessionReq.execute();
                logger.info("Session Switch Response ({}): {}", switchSessionRes.getStatusCode(), switchSessionRes.getBody());
            } catch (Exception e) {
                logger.error("Error during Session Switch API request for player {}", username, e);
            }

            // Handle Discord Switch API
            try {
                DiscordSwitch discordSwitch = DiscordSwitch.builder()
                        .username(username)
                        .server(server)
                        .build();

                Request discordSwitchReq = Request.builder()
                        .setURL(BaseAPIURL + "/discord/switch")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", APIKey)
                        .setRequestBody(discordSwitch.toString())
                        .build();

                Response discordSwitchRes = discordSwitchReq.execute();
                logger.info("Discord Switch Response ({}): {}", discordSwitchRes.getStatusCode(), discordSwitchRes.getBody());
            } catch (Exception e) {
                logger.error("Error during Discord Switch API request for player {}", username, e);
            }
        }).schedule();
    }
}
=======
        // Handle Session Switch API
        try {
            SessionSwitch switchSession = SessionSwitch.builder()
                    .uuid(playerUUID)
                    .server(server)
                    .build();

            Request switchSessionReq = Request.builder()
                    .setURL(BaseAPIURL + "/session/switch")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", APIKey)
                    .setRequestBody(switchSession.toString())  // Ensure this method works properly
                    .build();

            Response switchSessionRes = switchSessionReq.execute();
            logger.info("Session Switch Response ({}): {}", switchSessionRes.getStatusCode(), switchSessionRes.getBody());
        } catch (Exception e) {
            logger.error("Error during Session Switch API request", e);
            player.disconnect(Component.text("An error has occurred. Please try again later.").color(NamedTextColor.RED));
            return; // Exit if a session switch fails
        }

        // Handle Discord Switch API
        try {
            DiscordSwitch discordSwitch = DiscordSwitch.builder()
                    .username(username)
                    .server(server)
                    .build();

            Request discordSwitchReq = Request.builder()
                    .setURL(BaseAPIURL + "/discord/switch")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", APIKey)
                    .setRequestBody(discordSwitch.toString())  // Ensure this method works properly
                    .build();

            Response discordSwitchRes = discordSwitchReq.execute();
            logger.info("Discord Switch Response ({}): {}", discordSwitchRes.getStatusCode(), discordSwitchRes.getBody());
        } catch (Exception e) {
            logger.error("Error during Discord Switch API request", e);
            player.sendMessage(Component.text("An error occurred, but you can still continue playing.").color(NamedTextColor.RED));
        }
    }
}
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
