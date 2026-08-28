package org.modularsoft.zander.auth.events;

import com.jayway.jsonpath.JsonPath;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.md_5.bungee.api.chat.TextComponent;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.modularsoft.zander.auth.ZanderAuthMain;
import org.modularsoft.zander.auth.model.user.UserAuth;

public class AuthPlayerJoin implements Listener {
    ZanderAuthMain plugin;
    public AuthPlayerJoin(ZanderAuthMain plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();

        try {
            //
            // Send a user verification request.
            //
            UserAuth authUser = UserAuth.builder()
                    .uuid(player.getUniqueId())
                    .username(player.getDisplayName())
                    .build();

            Request authUserReq = Request.builder()
                    .setURL(plugin.getConfig().get("BaseAPIURL") + "/user/verify")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", String.valueOf(plugin.getConfig().get("APIKey")))
                    .setRequestBody(authUser.toString())
                    .build();

            Response authUserRes = authUserReq.execute();
            String authUserJson = authUserRes.getBody();

            Boolean success = JsonPath.parse(authUserJson).read("$.success");
            String message = JsonPath.read(authUserJson, "$.message");

            plugin.getLogger().info("Success: " + success);
            plugin.getLogger().info("Message: " + message);

            if (success) {
                event.getPlayer().kickPlayer(ChatColor.GREEN + message);
            } else if (message != null && message.toLowerCase().contains("already")
                    && message.toLowerCase().contains("linked")) {
                // Not a failure — the player is already linked and simply
                // doesn't need to be on this auth-only server.
                event.getPlayer().kickPlayer(ChatColor.GREEN
                        + "You're already linked — no need to be here. You can rejoin the main server.");
            } else {
                event.getPlayer().kickPlayer(ChatColor.RED + message);
            }
        } catch (Exception e) {
            String reason = ChatColor.RED + "An error has occurred. Is the API down?";
            player.kickPlayer(reason);
            System.out.println(e);
        }
    }
}
