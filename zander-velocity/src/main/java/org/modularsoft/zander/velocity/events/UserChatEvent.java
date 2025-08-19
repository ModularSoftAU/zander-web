package org.modularsoft.zander.velocity.events;

import com.jayway.jsonpath.JsonPath;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.PlayerChatEvent;
import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.Filter;
import org.modularsoft.zander.velocity.model.discord.DiscordChat;

public class UserChatEvent {

    @Subscribe
    public void UserChatEvent(PlayerChatEvent event) {
        Player player = event.getPlayer();
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

        // Filter out commands.
        if (event.getMessage().startsWith("/")) return;

        // Check chat for blocked content
        try {
            Filter phrase = Filter.builder()
                    .content(event.getMessage().toString())
                    .build();

            Request phraseReq = Request.builder()
                    .setURL(BaseAPIURL + "/filter")
                    .setMethod(Request.Method.POST)
                    .addHeader("x-access-token", APIKey)
                    .setRequestBody(phrase.toString())
                    .build();

            Response phraseRes = phraseReq.execute();
            String phraseJson = phraseRes.getBody();

            Boolean success = JsonPath.parse(phraseJson).read("$.success");
            String phraseCaughtMessage = JsonPath.read(phraseJson, "$.message");

            ZanderVelocityMain.getLogger().info("[FILTER] Response (" + phraseRes.getStatusCode() + "): " + phraseRes.getBody());

            if (!success) {
                Component builder = Component.text(phraseCaughtMessage).color(NamedTextColor.RED);
                player.sendMessage(builder);
                event.setResult(PlayerChatEvent.ChatResult.denied());
            } else {
                DiscordChat chat = DiscordChat.builder()
                        .username(player.getUsername())
                        .server(player.getCurrentServer().get().getServer().getServerInfo().getName())
                        .content(event.getMessage().toString())
                        .build();

                Request discordChatReq = Request.builder()
                        .setURL(BaseAPIURL + "/discord/chat")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", String.valueOf(APIKey))
                        .setRequestBody(chat.toString())
                        .build();

                Response discordChatReqRes = discordChatReq.execute();
                ZanderVelocityMain.getLogger().info("Response (" + discordChatReqRes.getStatusCode() + "): " + discordChatReqRes.getBody());
            }
        } catch (Exception e) {
            Component builder = Component.text("The chat filter could not be reached at this time, there maybe an issue with the API.").color(NamedTextColor.YELLOW);
            player.sendMessage(builder);
            System.out.println(e);
        }
    }
}
