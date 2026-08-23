package org.modularsoft.zander.velocity.events.session;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.PostLoginEvent;
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
import org.modularsoft.zander.velocity.model.discord.DiscordJoin;
import org.modularsoft.zander.velocity.model.session.SessionCreate;
import org.modularsoft.zander.velocity.model.user.UserCreation;

public class UserOnLogin {
    @Subscribe
    public void UserLoginEvent (PostLoginEvent event) {
        Player player = event.getPlayer();
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));
<<<<<<< HEAD
        ZanderVelocityMain.getPrivateMessageService().updateNameCache(player.getUniqueId(), player.getUsername());

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
            String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
            String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

            try {
                //
                // Send User Creation API POST for new user
                //
                UserCreation createUser = UserCreation.builder()
                        .uuid(player.getUniqueId())
                        .username(player.getUsername())
                        .build();

                Request createUserReq = Request.builder()
                        .setURL(BaseAPIURL + "/user/create")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", APIKey)
                        .setRequestBody(createUser.toString())
                        .build();

                Response createUserRes = createUserReq.execute();
                ZanderVelocityMain.getLogger().info("User creation response (" + createUserRes.getStatusCode() + "): " + createUserRes.getBody());

                //
=======

        try {
            //
            // Send User Creation API POST for new user
            //
            UserCreation createUser = UserCreation.builder()
                    .uuid(player.getUniqueId())
                    .username(player.getUsername())
                    .build();

            Request createUserReq = Request.builder()
                    .setURL(BaseAPIURL + "/user/create")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", APIKey)
                    .setRequestBody(createUser.toString())
                    .build();

            Response createUserRes = createUserReq.execute();
            ZanderVelocityMain.getLogger().info("Response (" + createUserRes.getStatusCode() + "): " + createUserRes.getBody());

            try {
                //
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
                // Start Session API POST
                //
                SessionCreate createSession = SessionCreate.builder()
                        .uuid(player.getUniqueId())
                        .ipAddress(player.getRemoteAddress().getAddress().toString())
                        .build();

                Request createSessionReq = Request.builder()
                        .setURL(BaseAPIURL + "/session/create")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", APIKey)
                        .setRequestBody(createSession.toString())
                        .build();

                Response createSessionRes = createSessionReq.execute();
<<<<<<< HEAD
                ZanderVelocityMain.getLogger().info("Session creation response (" + createSessionRes.getStatusCode() + "): " + createSessionRes.getBody());
=======
                ZanderVelocityMain.getLogger().info("Response (" + createSessionRes.getStatusCode() + "): " + createSessionRes.getBody());
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9

                // Send Discord API POST for join message
                DiscordJoin join = DiscordJoin.builder()
                        .username(player.getUsername())
                        .build();

                Request discordJoinReq = Request.builder()
                        .setURL(BaseAPIURL + "/discord/join")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", APIKey)
                        .setRequestBody(join.toString())
                        .build();

                Response discordJoinRes = discordJoinReq.execute();
<<<<<<< HEAD
                ZanderVelocityMain.getLogger().info("Discord join response (" + discordJoinRes.getStatusCode() + "): " + discordJoinRes.getBody());

            } catch (Exception e) {
                ZanderVelocityMain.getLogger().error("An error occurred during the async login process for " + player.getUsername(), e);
            }
        }).schedule();
=======
                ZanderVelocityMain.getLogger().info("Response (" + discordJoinRes.getStatusCode() + "): " + discordJoinRes.getBody());
            } catch (Exception e) {
                Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
                player.disconnect(builder);
            }
        } catch (Exception e) {
            Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
            player.disconnect(builder);
        }
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
    }
}
