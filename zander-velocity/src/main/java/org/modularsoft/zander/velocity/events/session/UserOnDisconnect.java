package org.modularsoft.zander.velocity.events.session;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.discord.DiscordLeave;
import org.modularsoft.zander.velocity.model.session.SessionDestroy;

public class UserOnDisconnect {
    @Subscribe
    public void UserDisconnectEvent (DisconnectEvent event) {
        Player player = event.getPlayer();
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

        boolean isConnected = isConnected(ZanderVelocityMain.getProxy(), player.getUsername());
        if (isConnected) return;

        //
        // Destory Session API POST
        //
        try {
            SessionDestroy destroySession = SessionDestroy.builder()
                    .uuid(player.getUniqueId())
                    .build();

            Request destroySessionReq = Request.builder()
                    .setURL(BaseAPIURL + "/session/destroy")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", APIKey)
                    .setRequestBody(destroySession.toString())
                    .build();

            Response destroySessionRes = destroySessionReq.execute();
            ZanderVelocityMain.getLogger().info("Response (" + destroySessionRes.getStatusCode() + "): " + destroySessionRes.getBody());
        } catch (Exception e) {
            Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
            player.disconnect(builder);
        }

        //
        // Send Discord API POST for disconnect message
        //
        try {
            DiscordLeave leave = DiscordLeave.builder()
                    .username(player.getUsername())
                    .build();

            Request discordLeaveReq = Request.builder()
                    .setURL(BaseAPIURL + "/discord/leave")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", APIKey)
                    .setRequestBody(leave.toString())
                    .build();

            Response discordLeaveRes = discordLeaveReq.execute();
            ZanderVelocityMain.getLogger().info("Response (" + discordLeaveRes.getStatusCode() + "): " + discordLeaveRes.getBody());
        } catch (Exception e) {
            Component builder = Component.text("An error has occurred. Is the API down?").color(NamedTextColor.RED);
            player.disconnect(builder);
        }
    }

    public static boolean isConnected(ProxyServer proxy, String playerName) {
        Player player = proxy.getPlayer(playerName).orElse(null);
        return player != null;
    }
}
