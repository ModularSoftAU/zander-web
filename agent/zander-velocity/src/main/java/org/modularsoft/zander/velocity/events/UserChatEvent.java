package org.modularsoft.zander.velocity.events;

import com.jayway.jsonpath.JsonPath;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.PlayerChatEvent;
import com.velocitypowered.api.proxy.Player;
import dev.dejvokep.boostedyaml.route.Route;
import io.github.ModularEnigma.Request;
import io.github.ModularEnigma.Response;
import net.kyori.adventure.text.Component;
<<<<<<< HEAD
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
=======
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.cacheddata.CachedMetaData;
import net.luckperms.api.model.user.User;
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.model.Filter;
import org.modularsoft.zander.velocity.model.discord.DiscordChat;

<<<<<<< HEAD
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class UserChatEvent {

    private final MiniMessage miniMessage = MiniMessage.miniMessage();

    @Subscribe
    public void UserChatEvent(PlayerChatEvent event) {
        Player player = event.getPlayer();
        String rawMessage = event.getMessage();
        Component originalMessage = Component.text(rawMessage);
        String BaseAPIURL = ZanderVelocityMain.getConfig().getString(Route.from("BaseAPIURL"));
        String APIKey = ZanderVelocityMain.getConfig().getString(Route.from("APIKey"));

        // Filter out commands.
        if (rawMessage.startsWith("/")) return;

        // Check chat for blocked content
        try {
            Filter phrase = Filter.builder()
                    .content(rawMessage)
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
                return;
            } else {
                DiscordChat chat = DiscordChat.builder()
                        .username(player.getUsername())
                        .server(player.getCurrentServer().get().getServer().getServerInfo().getName())
                        .content(rawMessage)
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

            Component formattedMessage = formatChatMessage(player, originalMessage);
            player.getCurrentServer()
                    .map(serverConnection -> serverConnection.getServer())
                    .ifPresentOrElse(
                            server -> server.getPlayersConnected().forEach(target -> target.sendMessage(formattedMessage)),
                            () -> player.sendMessage(formattedMessage)
                    );
            event.setResult(PlayerChatEvent.ChatResult.denied());
        } catch (Exception e) {
            Component builder = Component.text("The chat filter could not be reached at this time, there maybe an issue with the API.").color(NamedTextColor.YELLOW);
            player.sendMessage(builder);
            event.setResult(PlayerChatEvent.ChatResult.denied());
            ZanderVelocityMain.getLogger().error("Chat filter error for player {}", player.getUsername(), e);
        }
    }

    private Component formatChatMessage(Player player, Component originalMessage) {
        LuckPermsMeta metaData = resolveLuckPermsMeta(player).orElse(null);
        Component rankPrefix = buildRankPrefix(metaData);

        return Component.text()
                .append(rankPrefix)
                .append(Component.space())
                .append(Component.text(player.getUsername()))
                .append(Component.text(": "))
                .append(originalMessage)
                .build();
    }

    private Component buildRankPrefix(LuckPermsMeta metaData) {
        String prefix = metaData != null ? metaData.prefix : null;
        String rankNameMeta = getMetaValue(metaData, "displayname");
        String rankDescriptionMeta = getMetaValue(metaData, "rank_description");

        String rankName = (rankNameMeta != null && !rankNameMeta.isBlank())
                ? rankNameMeta
                : (prefix != null && !prefix.isBlank() ? prefix : "Member");
        String rankDescription = (rankDescriptionMeta != null && !rankDescriptionMeta.isBlank())
                ? rankDescriptionMeta
                : "No description set for this rank.";

        rankName = stripLegacy(rankName);
        rankDescription = stripLegacy(rankDescription);

        Component prefixComponent = buildPrefixComponent(prefix, rankName);
        Component hoverText = Component.text()
                .append(prefixComponent)
                .append(Component.space())
                .append(Component.text(rankName).color(NamedTextColor.GOLD))
                .append(Component.newline())
                .append(Component.text(rankDescription).color(NamedTextColor.GRAY))
                .build();

        return prefixComponent.hoverEvent(HoverEvent.showText(hoverText));
    }

    private String getMetaValue(LuckPermsMeta metaData, String baseKey) {
        if (metaData == null) {
            return null;
        }
        String scopedKey = null;
        if (metaData.primaryGroup != null && !metaData.primaryGroup.isBlank()) {
            scopedKey = baseKey + "." + metaData.primaryGroup;
        }
        if (scopedKey != null) {
            String scopedValue = metaData.metaValues.get(scopedKey);
            if (scopedValue != null && !scopedValue.isBlank()) {
                return scopedValue;
            }
        }
        String directValue = metaData.metaValues.get(baseKey);
        if (directValue != null && !directValue.isBlank()) {
            return directValue;
        }
        return null;
    }

    private Component buildPrefixComponent(String prefix, String rankName) {
        if (prefix != null && !prefix.isBlank()) {
            return LegacyComponentSerializer.legacyAmpersand().deserialize(prefix);
        }

        String miniMessagePrefix = "<dark_gray>[</dark_gray><yellow>"
                + escapeMiniMessageContent(rankName)
                + "</yellow><dark_gray>]</dark_gray>";
        return miniMessage.deserialize(miniMessagePrefix);
    }

    private String escapeMiniMessageContent(String input) {
        return input.replace("<", "\\<").replace(">", "\\>");
    }

    private String stripLegacy(String input) {
        return input.replaceAll("§.", "").replaceAll("&.", "");
    }

    private Optional<LuckPermsMeta> resolveLuckPermsMeta(Player player) {
        try {
            Class<?> providerClass = Class.forName("net.luckperms.api.LuckPermsProvider");
            Object luckPerms = providerClass.getMethod("get").invoke(null);
            Object playerAdapter = luckPerms.getClass().getMethod("getPlayerAdapter", Class.class)
                    .invoke(luckPerms, Player.class);
            Object user = playerAdapter.getClass().getMethod("getUser", Player.class).invoke(playerAdapter, player);
            Object metaData = playerAdapter.getClass().getMethod("getMetaData", Player.class).invoke(playerAdapter, player);

            String prefix = null;
            String primaryGroup = null;
            Map<String, List<String>> metaMap = Map.of();

            if (user != null) {
                Method primaryGroupMethod = user.getClass().getMethod("getPrimaryGroup");
                Object primaryGroupResult = primaryGroupMethod.invoke(user);
                if (primaryGroupResult instanceof String) {
                    primaryGroup = (String) primaryGroupResult;
                }
            }

            if (metaData != null) {
                Method prefixMethod = metaData.getClass().getMethod("getPrefix");
                Object prefixResult = prefixMethod.invoke(metaData);
                if (prefixResult instanceof String) {
                    prefix = (String) prefixResult;
                }
                Method metaMethod = metaData.getClass().getMethod("getMeta");
                Object metaResult = metaMethod.invoke(metaData);
                if (metaResult instanceof Map<?, ?> rawMeta) {
                    metaMap = castMetaMap(rawMeta);
                }
            }

            return Optional.of(new LuckPermsMeta(prefix, primaryGroup, flattenMeta(metaMap)));
        } catch (ReflectiveOperationException | LinkageError ignored) {
            return Optional.empty();
        }
    }

    private Map<String, String> flattenMeta(Map<String, List<String>> metaMap) {
        Map<String, String> flattened = new java.util.HashMap<>();
        for (Map.Entry<String, List<String>> entry : metaMap.entrySet()) {
            List<String> values = entry.getValue();
            if (values == null) {
                continue;
            }
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    flattened.put(entry.getKey(), value);
                    break;
                }
            }
        }
        return flattened;
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<String>> castMetaMap(Map<?, ?> rawMeta) {
        Map<String, List<String>> casted = new java.util.HashMap<>();
        for (Map.Entry<?, ?> entry : rawMeta.entrySet()) {
            Object key = entry.getKey();
            Object value = entry.getValue();
            if (key instanceof String && value instanceof List<?> listValue) {
                casted.put((String) key, (List<String>) listValue);
            }
        }
        return casted;
    }

    private static class LuckPermsMeta {
        private final String prefix;
        private final String primaryGroup;
        private final Map<String, String> metaValues;

        private LuckPermsMeta(String prefix, String primaryGroup, Map<String, String> metaValues) {
            this.prefix = prefix;
            this.primaryGroup = primaryGroup;
            this.metaValues = metaValues;
=======
import java.util.concurrent.CompletableFuture;

public class UserChatEvent {

    private final LuckPerms luckPerms;
    private final MiniMessage miniMessage = MiniMessage.miniMessage();
    private final LegacyComponentSerializer legacySerializer = LegacyComponentSerializer.builder().character('&').hexColors().build();

    public UserChatEvent(LuckPerms luckPerms) {
        this.luckPerms = luckPerms;
    }

    private Component buildRankPrefix(User user) {
        final CachedMetaData metaData = user.getCachedData().getMetaData();

        String displayName = metaData.getMetaValue("displayname");
        String rankDescription = metaData.getMetaValue("rank_description");

        if (rankDescription == null || rankDescription.isEmpty()) {
            rankDescription = "No description set for this rank.";
        }

        Component prefixComponent;
        // Use the clean displayname if it exists
        if (displayName != null && !displayName.isEmpty()) {
            prefixComponent = miniMessage.deserialize("<dark_gray>[</dark_gray><yellow>" + displayName + "</yellow><dark_gray>]");
        } else {
            // Otherwise, fall back to the raw prefix which may contain legacy codes
            String rawPrefix = metaData.getPrefix();
            if (rawPrefix != null && !rawPrefix.isEmpty()) {
                Component legacyPrefix = this.legacySerializer.deserialize(rawPrefix);
                // For the hover, we need a clean, plain-text version of the prefix
                displayName = PlainTextComponentSerializer.plainText().serialize(legacyPrefix);
                prefixComponent = legacyPrefix;
            } else {
                // If no prefix exists either, default to "Member"
                displayName = "Member";
                prefixComponent = miniMessage.deserialize("<dark_gray>[</dark_gray><yellow>Member</yellow><dark_gray>]");
            }
        }

        Component hoverComponent = miniMessage.deserialize("<gold>" + displayName + "</gold>\n<gray>" + rankDescription + "</gray>");

        return prefixComponent.hoverEvent(hoverComponent);
    }

    @Subscribe
    public void onPlayerChat(PlayerChatEvent event) {
        Player player = event.getPlayer();
        String message = event.getMessage();

        if (message.startsWith("/")) {
            return;
        }

        event.setResult(PlayerChatEvent.ChatResult.denied());

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

            luckPerms.getUserManager().loadUser(player.getUniqueId()).thenAcceptAsync(user -> {
                Component prefix = buildRankPrefix(user);
                Component finalMessage = prefix
                        .append(Component.text(" " + player.getUsername() + ": "))
                        .append(legacySerializer.deserialize(message));

                player.getCurrentServer().ifPresent(server -> {
                    for (Player p : server.getServer().getPlayersConnected()) {
                        p.sendMessage(finalMessage);
                    }
                });
            }).exceptionally(ex -> {
                ZanderVelocityMain.getLogger().error("Could not load LuckPerms user data for " + player.getUsername(), ex);
                Component finalMessage = Component.text(player.getUsername() + ": ").append(legacySerializer.deserialize(message));
                player.getCurrentServer().ifPresent(server -> {
                    for (Player p : server.getServer().getPlayersConnected()) {
                        p.sendMessage(finalMessage);
                    }
                });
                return null;
            });
        });
    }

    private void sendToDiscord(Player player, String message, String baseApiUrl, String apiKey) {
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
>>>>>>> c463c2e9ee1b08497c6fc915d690ac74884a2da9
        }
    }
}
