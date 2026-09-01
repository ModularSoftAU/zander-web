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
import org.modularsoft.zander.velocity.util.api.FriendService;

import java.util.List;
import java.util.Set;

public class UserOnLogin {
    @Subscribe
    public void UserLoginEvent (PostLoginEvent event) {
        Player player = event.getPlayer();
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));
        ZanderVelocityMain.getPrivateMessageService().updateNameCache(player.getUniqueId(), player.getUsername());

        ZanderVelocityMain.getProxy().getScheduler().buildTask(ZanderVelocityMain.getInstance(), () -> {
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
                ZanderVelocityMain.getLogger().info("Session creation response (" + createSessionRes.getStatusCode() + "): " + createSessionRes.getBody());

                //
                // Friends: warm the cache, deliver any requests that arrived
                // while this player was offline, and greet them with who's on.
                //
                try {
                    FriendService friendService = ZanderVelocityMain.getFriendService();
                    friendService.refresh(player.getUniqueId());

                    List<String> delivered = friendService.consumeUndelivered(player.getUniqueId());
                    if (!delivered.isEmpty()) {
                        player.sendMessage(Component.text("You have " + delivered.size()
                                        + " pending friend request" + (delivered.size() == 1 ? "" : "s")
                                        + ": " + String.join(", ", delivered))
                                .color(NamedTextColor.AQUA));
                        player.sendMessage(Component.text("Use /friend requests to respond.")
                                .color(NamedTextColor.GRAY));
                    }

                    Set<String> onlineFriends = friendService.onlineFriends(player.getUniqueId());
                    if (!onlineFriends.isEmpty()) {
                        player.sendMessage(Component.text(onlineFriends.size() + " of your friends "
                                        + (onlineFriends.size() == 1 ? "is" : "are") + " online: "
                                        + String.join(", ", onlineFriends))
                                .color(NamedTextColor.GREEN));
                    }
                } catch (Exception friendsError) {
                    ZanderVelocityMain.getLogger().warn("[friends] login delivery failed for "
                            + player.getUsername(), friendsError);
                }

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
                ZanderVelocityMain.getLogger().info("Discord join response (" + discordJoinRes.getStatusCode() + "): " + discordJoinRes.getBody());

            } catch (Exception e) {
                ZanderVelocityMain.getLogger().error("An error occurred during the async login process for " + player.getUsername(), e);
            }
        }).schedule();
    }
}
