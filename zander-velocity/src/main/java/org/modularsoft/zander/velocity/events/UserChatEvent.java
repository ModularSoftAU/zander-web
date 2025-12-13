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

    private String escapeMiniMessageAttribute(String str) {
        if (str == null) return "";
        return str.replace("'", "\\'");
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

        final String hoverText = "<gold>" + escapeMiniMessageAttribute(displayName) + "</gold>\n<gray>" + escapeMiniMessageAttribute(rankDescription) + "</gray>";
        final String prefixText = "<dark_gray>[</dark_gray><yellow>" + displayName + "</yellow><dark_gray>]";
        String fullPrefixMiniMessage = "<hover:show_text:'" + hoverText + "'>" + prefixText + "</hover>";

        return miniMessage.deserialize(fullPrefixMiniMessage);
    }

    @Subscribe
    public void onPlayerChat(PlayerChatEvent event) {
        Player player = event.getPlayer();
        String message = event.getMessage();

        if (message.startsWith("/")) {
            return;
        }

        // Prevent the original message from being sent
        event.setResult(PlayerChatEvent.ChatResult.denied());

        // Asynchronously process the chat message
        CompletableFuture.runAsync(() -> {
            String baseApiUrl = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
            String apiKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

            // --- 1. Asynchronous Chat Filtering ---
            try {
                Filter phrase = Filter.builder().content(message).build();
                Request phraseReq = Request.builder()
                        .setURL(baseApiUrl + "/filter")
                        .setMethod(Request.Method.POST)
                        .addHeader("x-access-token", apiKey)
                        .setRequestBody(phrase.toString())
                        .build();

                Response phraseRes = phraseReq.execute(); // This is still blocking, but now off the main thread
                String phraseJson = phraseRes.getBody();
                boolean success = JsonPath.parse(phraseJson).read("$.success");

                if (!success) {
                    String phraseCaughtMessage = JsonPath.read(phraseJson, "$.message");
                    player.sendMessage(Component.text(phraseCaughtMessage, NamedTextColor.RED));
                    return; // Stop processing
                }

                // --- 2. Asynchronous Discord Webhook ---
                sendToDiscord(player, message, baseApiUrl, apiKey);

            } catch (Exception e) {
                player.sendMessage(Component.text("The chat filter could not be reached. Contact staff if this persists.", NamedTextColor.YELLOW));
                ZanderVelocityMain.getLogger().error("Error while filtering chat message: ", e);
                // We can still proceed to format and send the message locally
            }

            // --- 3. Asynchronous LuckPerms User Loading and Message Broadcasting ---
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
                // Fallback: send without prefix
                Component messageComponent = Component.text(message);
                Component finalMessage = Component.text(player.getUsername() + ": ").append(messageComponent);
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
