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
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.cacheddata.CachedMetaData;
import net.luckperms.api.model.user.User;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.Filter;
import org.modularsoft.zander.velocity.model.discord.DiscordChat;

import java.util.concurrent.CompletableFuture;

public class UserChatEvent {

    private final LuckPerms luckPerms;
    private final MiniMessage miniMessage = MiniMessage.miniMessage();

    public UserChatEvent(LuckPerms luckPerms) {
        this.luckPerms = luckPerms;
    }

    private Component buildRankPrefix(User user) {
        final CachedMetaData metaData = user.getCachedData().getMetaData();
        String displayName = metaData.getMetaValue("displayname");
        if (displayName == null || displayName.isEmpty()) {
            displayName = metaData.getPrefix();
            if (displayName != null) {
                displayName = miniMessage.stripTags(displayName);
            }
            if (displayName == null || displayName.isEmpty()) {
                displayName = "Member";
            }
        }

        String rankDescription = metaData.getMetaValue("rank_description");
        if (rankDescription == null || rankDescription.isEmpty()) {
            rankDescription = "No description set for this rank.";
        }

        Component hoverComponent = miniMessage.deserialize("<gold>" + displayName + "</gold>\n<gray>" + rankDescription + "</gray>");
        Component prefixComponent = miniMessage.deserialize("<dark_gray>[</dark_gray><yellow>" + displayName + "</yellow><dark_gray>]");
        return prefixComponent.hoverEvent(hoverComponent);
    }

    @Subscribe
    public void onPlayerChat(PlayerChatEvent event) {
        Player player = event.getPlayer();
        String message = event.getMessage();

        if (message.startsWith("/")) {
            return;
        }

        // Deny the event to prevent the original message from being sent by Velocity.
        // The formatted message will be broadcast manually.
        event.setResult(PlayerChatEvent.ChatResult.denied());

        // Process filtering and formatting asynchronously to avoid blocking the main thread.
        CompletableFuture.runAsync(() -> {
            String baseApiUrl = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
            String apiKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

            try {
                Filter phrase = Filter.builder().content(message).build();
                Request phraseReq = Request.builder()
                        .setURL(baseApiUrl + "/filter")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", apiKey)
                        .setRequestBody(phrase.toString())
                        .build();
                Response phraseRes = phraseReq.execute();
                String phraseJson = phraseRes.getBody();
                boolean success = JsonPath.parse(phraseJson).read("$.success");

                if (!success) {
                    String phraseCaughtMessage = JsonPath.read(phraseJson, "$.message");
                    player.sendMessage(Component.text(phraseCaughtMessage, NamedTextColor.RED));
                    return;
                }
                sendToDiscord(player, message, baseApiUrl, apiKey);
            } catch (Exception e) {
                player.sendMessage(Component.text("The chat filter could not be reached. Contact staff if this persists.", NamedTextColor.YELLOW));
                ZanderVelocityMain.getLogger().error("Error while filtering chat message: ", e);
            }

            // Load user data, build the component, and broadcast it.
            luckPerms.getUserManager().loadUser(player.getUniqueId()).thenAcceptAsync(user -> {
                Component prefix = buildRankPrefix(user);
                Component messageComponent = Component.text(message);
                Component finalMessage = prefix
                        .append(Component.text(" " + player.getUsername() + ": "))
                        .append(messageComponent);

                for (Player p : ZanderVelocityMain.proxy.getAllPlayers()) {
                    p.sendMessage(finalMessage);
                }
            }).exceptionally(ex -> {
                ZanderVelocityMain.getLogger().error("Could not load LuckPerms user data for " + player.getUsername(), ex);
                Component finalMessage = Component.text(player.getUsername() + ": ").append(Component.text(message));
                for (Player p : ZanderVelocityMain.proxy.getAllPlayers()) {
                    p.sendMessage(finalMessage);
                }
                return null;
            });
        });
    }

    private void sendToDiscord(Player player, String message, String baseApiUrl, String apiKey) {
        ZanderVelocityMain.proxy.getScheduler().buildTask(ZanderVelocityMain.proxy.getPluginManager().getPlugin("zander-velocity").get(), () -> {
            try {
                DiscordChat chat = DiscordChat.builder()
                        .username(player.getUsername())
                        .server(player.getCurrentServer().map(s -> s.getServerInfo().getName()).orElse("unknown"))
                        .content(message)
                        .build();
                Request discordChatReq = Request.builder()
                        .setURL(baseApiUrl + "/discord/chat")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", apiKey)
                        .setRequestBody(chat.toString())
                        .build();
                discordChatReq.execute();
            } catch (Exception e) {
                ZanderVelocityMain.getLogger().error("Failed to send message to Discord webhook", e);
            }
        }).schedule();
    }
}
