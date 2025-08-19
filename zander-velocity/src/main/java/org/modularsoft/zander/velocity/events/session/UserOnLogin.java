package org.modularsoft.zander.velocity.events.session;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.PostLoginEvent;
import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
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
                ZanderVelocityMain.getLogger().info("Response (" + createSessionRes.getStatusCode() + "): " + createSessionRes.getBody());

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
                ZanderVelocityMain.getLogger().info("Response (" + discordJoinRes.getStatusCode() + "): " + discordJoinRes.getBody());
            } catch (Exception e) {
                Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
                player.disconnect(builder);
            }
        } catch (Exception e) {
            Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
            player.disconnect(builder);
        }
    }
}
